# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import timedelta

from sentry.models import GroupRuleStatus, Rule
from sentry.plugins.base import plugins
from sentry.rules.processor import RuleProcessor
from sentry.testutils import TestCase

from django.utils import timezone


class RuleProcessorTest(TestCase):
    # this test relies on a few other tests passing
    def test_integrated(self):
        event = self.store_event(data={}, project_id=self.project.id)
        action_data = {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
        condition_data = {"id": "sentry.rules.conditions.every_event.EveryEventCondition"}

        Rule.objects.filter(project=event.project).delete()
        rule = Rule.objects.create(
            project=event.project, data={"conditions": [condition_data], "actions": [action_data]}
        )

        rp = RuleProcessor(
            event,
            is_new=True,
            is_regression=True,
            is_new_group_environment=True,
            has_reappeared=True,
        )
        results = list(rp.apply())
        assert len(results) == 1
        callback, futures = results[0]
        assert callback == plugins.get("mail").rule_notify
        assert len(futures) == 1
        assert futures[0].rule == rule
        assert futures[0].kwargs == {}

        # should not apply twice due to default frequency
        results = list(rp.apply())
        assert len(results) == 0

        # now ensure that moving the last update backwards
        # in time causes the rule to trigger again
        GroupRuleStatus.objects.filter(rule=rule).update(
            last_active=timezone.now() - timedelta(minutes=Rule.DEFAULT_FREQUENCY + 1)
        )

        results = list(rp.apply())
        assert len(results) == 1
