import math
import statistics
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import TypedDict


class IssueForecast(TypedDict):
    forecasted_date: str
    forecasted_value: int


class GroupCount(TypedDict):
    intervals: list[str]
    data: list[int]


# standard values if no parameters are passed
@dataclass
class ThresholdVariables:
    std_multiplier: int = 5
    min_spike_multiplier: int = 5
    max_spike_multiplier: int = 8
    min_bursty_multiplier: int = 2
    max_bursty_multiplier: int = 5


standard_version = ThresholdVariables()


def generate_issue_forecast(
    data: GroupCount, start_time: datetime, alg_params: ThresholdVariables = standard_version
) -> list[IssueForecast]:
    """
    Calculates daily issue spike limits, given an input dataset from snuba.

    For issues with at least 14 days of history, we combine a weighted average of the last
    7 days of hourly data with the observed variance over that time interval. We double the
    weight if historical observation falls on the same day of week to incorporate daily seasonality.
    The overall multiplier is calibrated to 5 standard deviations, although it is
    truncated to [5, 8] to avoid poor results in a timeseries with very high
    or low variance.
    In addition, we also calculate the cv (coefficient of variance) of the timeseries the past week, which is the ratio of the
    standard deviation over the average. This is to get an understanding of how high or low the variance
    is relative to the data. The CV is then placed into an exponential equation that outputs
    a multiplier inversely related to how high the cv is. The multiplier is bounded between 2 and 5. The
    ceilings for the next week are all the same - which is the maximum number of events in an hour over the
    past week multiplied by this multiplier. This calculation is to account for bursty issues or those that
    have a very high variance.
    The final spike limit for each hour is set to the max of the bursty limit bound or the calculated limit.
    :param data: Dict of Snuba query results - hourly data over past 7 days
    :param start_time: datetime indicating the first hour to calc spike protection for
    :param alg_params: Threshold Variables dataclass with different ceiling versions
    :return output: Dict containing a list of spike protection values
    """

    # output list of dictionaries
    output: list[IssueForecast] = []

    input_dates = [datetime.strptime(x, "%Y-%m-%dT%H:%M:%S%f%z") for x in data["intervals"]]
    output_dates = [start_time + timedelta(days=x) for x in range(14)]

    ts_data = data["data"]

    # if data is empty return empty output
    if len(ts_data) == 0 or len(input_dates) == 0:
        return output

    ts_max = max(ts_data)

    # if we have less than a week's worth of data (new issue),
    # set the threshold to 10x the max of the dataset to account for
    # how the pattern of the issue will change over the first week
    if len(ts_data) < 168:
        for output_ts in output_dates:
            output.append(
                {"forecasted_date": output_ts.strftime("%Y-%m-%d"), "forecasted_value": ts_max * 10}
            )
        return output

    # gather stats from the timeseries - average, standard dev
    ts_avg = statistics.mean(ts_data)
    ts_std_dev = statistics.stdev(ts_data)

    # calculate cv to identify how high/low variance is
    ts_cv = ts_std_dev / ts_avg

    # multiplier determined by exponential equation - bounded between [2,5]
    regression_multiplier = min(
        max(alg_params.min_bursty_multiplier, 5 * ((math.e) ** (-0.65 * ts_cv))),
        alg_params.max_bursty_multiplier,
    )

    # first ceiling calculation
    limit_v1 = ts_max * regression_multiplier

    # This second multiplier corresponds to 5 standard deviations above the avg ts value
    ts_multiplier = min(
        max(
            (ts_avg + (alg_params.std_multiplier * ts_std_dev)) / ts_avg,
            alg_params.min_spike_multiplier,
        ),
        alg_params.max_spike_multiplier,
    )

    # Default upper limit is the truncated multiplier * avg value
    baseline = ts_multiplier * ts_avg

    for output_ts in output_dates:
        # Calculate weights (based on day of week)
        weights = [(1 + (input_ts.weekday() == output_ts.weekday())) for input_ts in input_dates]

        # Calculate weighted avg
        numerator = sum([datum * weight for datum, weight in zip(ts_data, weights)])
        wavg_limit = numerator / sum(weights)

        # second ceiling calculation
        limit_v2 = wavg_limit + baseline

        # final limit is max of the two calculations
        forecast: IssueForecast = {
            "forecasted_date": output_ts.strftime("%Y-%m-%d"),
            "forecasted_value": int(max(limit_v1, limit_v2)),
        }
        output.append(forecast)

    return output
