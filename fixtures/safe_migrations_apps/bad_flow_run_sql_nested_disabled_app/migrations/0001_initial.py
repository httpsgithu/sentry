# Generated by Django 3.1 on 2019-09-22 21:47

from django.db import migrations
from django.db.migrations import SeparateDatabaseAndState

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):

    initial = True

    dependencies = []

    allow_run_sql = False

    operations = [SeparateDatabaseAndState(database_operations=[migrations.RunSQL("select 1;")])]
