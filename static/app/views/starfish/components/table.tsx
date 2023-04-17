import {Component, Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptorObject} from 'history';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumn,
} from 'sentry/components/gridEditable';
import SortLink, {Alignments} from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {Tooltip} from 'sentry/components/tooltip';
import {IconStar} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import DiscoverQuery, {
  TableData,
  TableDataRow,
} from 'sentry/utils/discover/discoverQuery';
import EventView, {isFieldSortable, MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  ColumnType,
  fieldAlignment,
  getAggregateAlias,
} from 'sentry/utils/discover/fields';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import CellAction, {Actions, updateQuery} from 'sentry/views/discover/table/cellAction';
import {TableColumn} from 'sentry/views/discover/table/types';
import TransactionThresholdModal, {
  modalCss,
  TransactionThresholdMetric,
} from 'sentry/views/performance/transactionSummary/transactionThresholdModal';
import {
  normalizeSearchConditionsWithTransactionName,
  transactionSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/utils';

const COLUMN_TITLES = ['endpoint', 'tpm', 'p50(duration)', 'p95(duration)'];

import {getProjectID} from 'sentry/views/performance/utils';
import {TIME_SPENT_IN_SERVICE} from 'sentry/views/starfish/utils/generatePerformanceEventView';

import {
  createUnnamedTransactionsDiscoverTarget,
  UNPARAMETERIZED_TRANSACTION,
} from '../utils/createUnnamedTransactionsDiscoverTarget';

// HACK: Overrides ColumnType for TIME_SPENT_IN_SERVICE which is
// returned as a number because it's an equation, but we
// want formatted as a percentage
const TABLE_META_OVERRIDES: Record<string, ColumnType> = {
  [TIME_SPENT_IN_SERVICE]: 'percentage',
};

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  setError: (msg: string | undefined) => void;
  withStaticFilters: boolean;
  columnTitles?: string[];
  dataset?: 'discover' | 'metrics';
  summaryConditions?: string;
};

type State = {
  transaction: string | undefined;
  transactionThreshold: number | undefined;
  transactionThresholdMetric: TransactionThresholdMetric | undefined;
  widths: number[];
};
class _Table extends Component<Props, State> {
  state: State = {
    widths: [],
    transaction: undefined,
    transactionThreshold: undefined,
    transactionThresholdMetric: undefined,
  };

  handleCellAction = (column: TableColumn<keyof TableDataRow>, dataRow: TableDataRow) => {
    return (action: Actions, value: React.ReactText) => {
      const {eventView, location, organization, projects} = this.props;

      if (action === Actions.EDIT_THRESHOLD) {
        const project_threshold = dataRow.project_threshold_config;
        const transactionName = dataRow.transaction as string;
        const projectID = getProjectID(dataRow, projects);

        openModal(
          modalProps => (
            <TransactionThresholdModal
              {...modalProps}
              organization={organization}
              transactionName={transactionName}
              eventView={eventView}
              project={projectID}
              transactionThreshold={project_threshold[1]}
              transactionThresholdMetric={project_threshold[0]}
              onApply={(threshold, metric) => {
                if (
                  threshold !== project_threshold[1] ||
                  metric !== project_threshold[0]
                ) {
                  this.setState({
                    transaction: transactionName,
                    transactionThreshold: threshold,
                    transactionThresholdMetric: metric,
                  });
                }
                addSuccessMessage(
                  tct('[transactionName] updated successfully', {
                    transactionName,
                  })
                );
              }}
            />
          ),
          {modalCss, closeEvents: 'escape-key'}
        );
        return;
      }

      const searchConditions = normalizeSearchConditionsWithTransactionName(
        eventView.query
      );

      updateQuery(searchConditions, action, column, value);

      browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          cursor: undefined,
          query: searchConditions.formatString(),
        },
      });
    };
  };

  renderBodyCell(
    tableData: TableData | null,
    column: TableColumn<keyof TableDataRow>,
    dataRow: TableDataRow
  ): React.ReactNode {
    const {eventView, organization, projects, location, withStaticFilters} = this.props;

    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }
    const tableMeta = {...tableData.meta, ...TABLE_META_OVERRIDES};

    const field = String(column.key);
    const fieldRenderer = getFieldRenderer(field, tableMeta, false);
    const rendered = fieldRenderer(dataRow, {organization, location});

    const allowActions = [
      Actions.ADD,
      Actions.EXCLUDE,
      Actions.SHOW_GREATER_THAN,
      Actions.SHOW_LESS_THAN,
      Actions.EDIT_THRESHOLD,
    ];

    const cellActions = withStaticFilters ? [] : allowActions;

    if (field === 'transaction') {
      const projectID = getProjectID(dataRow, projects);
      const summaryView = eventView.clone();
      let prefix = '';
      if (dataRow['http.method']) {
        summaryView.additionalConditions.setFilterValues('http.method', [
          dataRow['http.method'] as string,
        ]);
        prefix = `${dataRow['http.method']} `;
      }
      summaryView.query = summaryView.getQueryWithAdditionalConditions();
      const isUnparameterizedRow = dataRow.transaction === UNPARAMETERIZED_TRANSACTION;
      const target = isUnparameterizedRow
        ? createUnnamedTransactionsDiscoverTarget({
            organization,
            location,
          })
        : transactionSummaryRouteWithQuery({
            orgSlug: organization.slug,
            transaction: String(dataRow.transaction) || '',
            query: summaryView.generateQueryStringObject(),
            projectID,
          });

      return (
        <CellAction
          column={column}
          dataRow={dataRow}
          handleCellAction={this.handleCellAction(column, dataRow)}
          allowActions={cellActions}
        >
          <Link to={target} style={{display: `block`, width: `100%`}}>
            {prefix}
            {dataRow.transaction}
          </Link>
        </CellAction>
      );
    }

    if (field === 'project') {
      return null;
    }
    if (field.startsWith('team_key_transaction')) {
      // don't display per cell actions for team_key_transaction
      return rendered;
    }

    const fieldName = getAggregateAlias(field);
    const value = dataRow[fieldName];
    if (tableMeta[fieldName] === 'integer' && typeof value === 'number' && value > 999) {
      return (
        <Tooltip
          title={value.toLocaleString()}
          containerDisplayMode="block"
          position="right"
        >
          <CellAction
            column={column}
            dataRow={dataRow}
            handleCellAction={this.handleCellAction(column, dataRow)}
            allowActions={cellActions}
          >
            {rendered}
          </CellAction>
        </Tooltip>
      );
    }

    return (
      <CellAction
        column={column}
        dataRow={dataRow}
        handleCellAction={this.handleCellAction(column, dataRow)}
        allowActions={cellActions}
      >
        {rendered}
      </CellAction>
    );
  }

  renderBodyCellWithData = (tableData: TableData | null) => {
    return (
      column: TableColumn<keyof TableDataRow>,
      dataRow: TableDataRow
    ): React.ReactNode => this.renderBodyCell(tableData, column, dataRow);
  };

  renderHeadCell(
    tableMeta: TableData['meta'],
    column: TableColumn<keyof TableDataRow>,
    title: React.ReactNode
  ): React.ReactNode {
    const {eventView, location} = this.props;

    // Hack to get equations to align and sort properly because
    // some of the functions called below aren't set up to handle
    // equations. Fudging code here to keep minimal footprint of
    // code changes.
    let align: Alignments = 'left';
    if (column.column.kind === 'equation') {
      align = 'right';
    } else {
      align = fieldAlignment(column.name, column.type, tableMeta);
    }
    const field = {
      field: column.column.kind === 'equation' ? (column.key as string) : column.name,
      width: column.width,
    };
    const aggregateAliasTableMeta: MetaType = {};
    if (tableMeta) {
      Object.keys(tableMeta).forEach(key => {
        aggregateAliasTableMeta[getAggregateAlias(key)] = tableMeta[key];
      });
    }

    function generateSortLink(): LocationDescriptorObject | undefined {
      if (!tableMeta) {
        return undefined;
      }

      const nextEventView = eventView.sortOnField(field, aggregateAliasTableMeta);
      const queryStringObject = nextEventView.generateQueryStringObject();

      return {
        ...location,
        query: {...location.query, sort: queryStringObject.sort},
      };
    }
    const currentSort = eventView.sortForField(field, aggregateAliasTableMeta);
    const canSort = isFieldSortable(field, aggregateAliasTableMeta);

    const currentSortKind = currentSort ? currentSort.kind : undefined;

    const sortLink = (
      <SortLink
        align={align}
        title={title || field.field}
        direction={currentSortKind}
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );
    if (field.field.startsWith('user_misery')) {
      return (
        <GuideAnchor target="project_transaction_threshold" position="top">
          {sortLink}
        </GuideAnchor>
      );
    }
    return sortLink;
  }

  renderHeadCellWithMeta = (tableMeta: TableData['meta']) => {
    const columnTitles = this.props.columnTitles ?? COLUMN_TITLES;
    return (column: TableColumn<keyof TableDataRow>, index: number): React.ReactNode =>
      this.renderHeadCell(tableMeta, column, columnTitles[index]);
  };

  renderPrependCellWithData = (tableData: TableData | null) => {
    const {eventView} = this.props;

    const teamKeyTransactionColumn = eventView
      .getColumns()
      .find((col: TableColumn<React.ReactText>) => col.name === 'team_key_transaction');
    return (isHeader: boolean, dataRow?: any) => {
      if (teamKeyTransactionColumn) {
        if (isHeader) {
          const star = (
            <TeamKeyTransactionWrapper>
              <IconStar
                key="keyTransaction"
                color="yellow400"
                isSolid
                data-test-id="team-key-transaction-header"
              />
            </TeamKeyTransactionWrapper>
          );
          return [this.renderHeadCell(tableData?.meta, teamKeyTransactionColumn, star)];
        }
        return [this.renderBodyCell(tableData, teamKeyTransactionColumn, dataRow)];
      }
      return [];
    };
  };

  handleResizeColumn = (columnIndex: number, nextColumn: GridColumn) => {
    const widths: number[] = [...this.state.widths];
    widths[columnIndex] = nextColumn.width
      ? Number(nextColumn.width)
      : COL_WIDTH_UNDEFINED;
    this.setState({widths});
  };

  render() {
    const {eventView, organization, location, setError} = this.props;
    const {widths, transaction, transactionThreshold} = this.state;
    const columnOrder = eventView
      .getColumns()
      // remove team_key_transactions from the column order as we'll be rendering it
      // via a prepended column
      .filter(
        (col: TableColumn<React.ReactText>) =>
          col.name !== 'team_key_transaction' &&
          !col.name.startsWith('count_miserable') &&
          col.name !== 'project_threshold_config' &&
          col.name !== 'project' &&
          col.name !== 'http.method' &&
          col.name !== 'total.transaction_duration' &&
          col.name !== 'sum(transaction.duration)'
      )
      .map((col: TableColumn<React.ReactText>, i: number) => {
        if (typeof widths[i] === 'number') {
          return {...col, width: widths[i]};
        }
        return col;
      });

    const columnSortBy = eventView.getSorts();

    const prependColumnWidths = ['max-content'];

    return (
      <GuideAnchor target="performance_table" position="top-start">
        <div data-test-id="performance-table">
          <DiscoverQuery
            eventView={eventView}
            orgSlug={organization.slug}
            location={location}
            setError={error => setError(error?.message)}
            referrer="api.performance.landing-table"
            transactionName={transaction}
            transactionThreshold={transactionThreshold}
            queryExtras={{dataset: this.props.dataset ?? 'metrics'}}
          >
            {({pageLinks, isLoading, tableData}) => (
              <Fragment>
                <VisuallyCompleteWithData
                  id="PerformanceTable"
                  hasData={!isLoading && !!tableData?.data && tableData.data.length > 0}
                >
                  <GridEditable
                    isLoading={isLoading}
                    data={tableData ? tableData.data : []}
                    columnOrder={columnOrder}
                    columnSortBy={columnSortBy}
                    grid={{
                      onResizeColumn: this.handleResizeColumn,
                      renderHeadCell: this.renderHeadCellWithMeta(tableData?.meta) as any,
                      renderBodyCell: this.renderBodyCellWithData(tableData) as any,
                      renderPrependColumns: this.renderPrependCellWithData(
                        tableData
                      ) as any,
                      prependColumnWidths,
                    }}
                    location={location}
                  />
                </VisuallyCompleteWithData>
                <Pagination pageLinks={pageLinks} />
              </Fragment>
            )}
          </DiscoverQuery>
        </div>
      </GuideAnchor>
    );
  }
}

function Table(props: Omit<Props, 'summaryConditions'> & {summaryConditions?: string}) {
  const summaryConditions =
    props.summaryConditions ?? props.eventView.getQueryWithAdditionalConditions();

  return <_Table {...props} summaryConditions={summaryConditions} />;
}

// Align the contained IconStar with the IconStar buttons in individual table
// rows, which have 2px padding + 1px border.
const TeamKeyTransactionWrapper = styled('div')`
  padding: 3px;
`;

export default Table;
