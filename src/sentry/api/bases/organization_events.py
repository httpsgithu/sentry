from __future__ import absolute_import

import six
from rest_framework.exceptions import PermissionDenied

from sentry.api.bases import OrganizationEndpoint, OrganizationEventsError
from sentry.api.event_search import InvalidSearchQuery, get_filter
from sentry.models.project import Project
from sentry.snuba.discover import ReferenceEvent
from sentry.utils.compat import map


class OrganizationEventsEndpointBase(OrganizationEndpoint):
    def get_snuba_filter(self, request, organization, params=None):
        if params is None:
            params = self.get_filter_params(request, organization)
        query = request.GET.get("query")
        try:
            return get_filter(query, params)
        except InvalidSearchQuery as e:
            raise OrganizationEventsError(six.text_type(e))

    def get_orderby(self, request):
        sort = request.GET.getlist("sort")
        if sort:
            return sort
        # Deprecated. `sort` should be used as it is supported by
        # more endpoints.
        orderby = request.GET.getlist("orderby")
        if orderby:
            return orderby

    def reference_event(self, request, organization, start, end):
        fields = request.GET.getlist("field")[:]
        reference_event_id = request.GET.get("referenceEvent")
        if reference_event_id:
            return ReferenceEvent(organization, reference_event_id, fields, start, end)

    def get_snuba_query_args_legacy(self, request, organization):
        params = self.get_filter_params(request, organization)

        group_ids = request.GET.getlist("group")
        if group_ids:
            # TODO(mark) This parameter should be removed in the long term.
            # Instead of using this parameter clients should use `issue.id`
            # in their query string.
            try:
                group_ids = set(map(int, [_f for _f in group_ids if _f]))
            except ValueError:
                raise OrganizationEventsError("Invalid group parameter. Values must be numbers")

            projects = Project.objects.filter(
                organization=organization, group__id__in=group_ids
            ).distinct()
            if any(p for p in projects if not request.access.has_project_access(p)):
                raise PermissionDenied
            params["group_ids"] = list(group_ids)
            params["project_id"] = list(set([p.id for p in projects] + params["project_id"]))

        query = request.GET.get("query")
        try:
            _filter = get_filter(query, params)
        except InvalidSearchQuery as e:
            raise OrganizationEventsError(six.text_type(e))

        snuba_args = {
            "start": _filter.start,
            "end": _filter.end,
            "conditions": _filter.conditions,
            "filter_keys": _filter.filter_keys,
        }

        return snuba_args
