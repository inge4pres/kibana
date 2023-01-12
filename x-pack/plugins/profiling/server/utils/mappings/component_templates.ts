/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import ClusterApi from '@elastic/elasticsearch/lib/api/api/cluster';
import { ClusterPutComponentTemplateResponse } from '@elastic/elasticsearch/lib/api/types';

export async function componentTemplates(
  client: ClusterApi
): Promise<ClusterPutComponentTemplateResponse[]> {
  // TODO: how to read files from a JSON resource instead of inlining here?
  return Promise.all([
    client.putComponentTemplate({
      name: 'profiling-ilm',
      // for idempotency, we allow overwriting the component templates
      create: false,
      template: {
        settings: {
          index: {
            lifecycle: {
              name: 'profiling',
            },
          },
        },
      },
    }),
    client.putComponentTemplate({
      name: 'profiling-events',
      // for idempotency, we allow overwriting the component templates
      create: false,
      template: {
        settings: {
          index: {
            number_of_shards: '4',
            max_result_window: 150000,
            refresh_interval: '10s',
            sort: {
              field: [
                'service.name',
                '@timestamp',
                'orchestrator.resource.name',
                'container.name',
                'process.thread.name',
                'host.id',
              ],
            },
          },
          codec: 'best_compression',
        },
        mappings: {
          _source: {
            enabled: false,
          },
          properties: {
            'ecs.version': {
              type: 'keyword',
              index: true,
            },
            'service.name': {
              type: 'keyword',
            },
            '@timestamp': {
              type: 'date',
              format: 'epoch_second',
            },
            'host.id': {
              type: 'keyword',
            },
            'Stacktrace.id': {
              type: 'keyword',
              index: false,
            },
            'orchestrator.resource.name': {
              type: 'keyword',
            },
            'container.name': {
              type: 'keyword',
            },
            'process.thread.name': {
              type: 'keyword',
            },
            'Stacktrace.count': {
              type: 'short',
              index: false,
            },
            'agent.version': {
              type: 'keyword',
            },
            'host.ip': {
              type: 'ip',
            },
            'host.ipstring': {
              type: 'keyword',
            },
            'host.name': {
              type: 'keyword',
            },
            'os.kernel': {
              type: 'keyword',
            },
            tags: {
              type: 'keyword',
            },
          },
        },
      },
      _meta: {
        description: 'Mappings for profiling events data stream',
      },
    }),
    client.putComponentTemplate({
      name: 'profiling-executables',
      // for idempotency, we allow overwriting the component templates
      create: false,
      template: {
        settings: {
          index: {
            refresh_interval: '10s',
          },
        },
        mappings: {
          _source: {
            mode: 'synthetic',
          },
          properties: {
            'ecs.version': {
              type: 'keyword',
              index: true,
            },
            'Executable.build.id': {
              type: 'keyword',
              index: true,
            },
            'Executable.file.name': {
              type: 'keyword',
              index: true,
            },
            '@timestamp': {
              type: 'date',
              format: 'epoch_second',
            },
          },
        },
      },
    }),
    client.putComponentTemplate({
      name: 'profiling-stackframes',
      // for idempotency, we allow overwriting the component templates
      create: false,
      template: {
        settings: {
          index: {
            number_of_shards: 16,
            refresh_interval: '10s',
          },
        },
        mappings: {
          _source: {
            mode: 'synthetic',
          },
          properties: {
            'ecs.version': {
              type: 'keyword',
              index: true,
            },
            'Stackframe.line.number': {
              type: 'integer',
              index: false,
            },
            'Stackframe.file.name': {
              type: 'keyword',
              index: false,
            },
            'Stackframe.source.type': {
              type: 'short',
              index: false,
            },
            'Stackframe.function.name': {
              type: 'keyword',
              index: false,
            },
            'Stackframe.function.offset': {
              type: 'integer',
              index: false,
            },
          },
        },
      },
    }),
    client.putComponentTemplate({
      name: 'profiling-stacktraces',
      // for idempotency, we allow overwriting the component templates
      create: false,
      template: {
        settings: {
          index: {
            number_of_shards: 16,
            refresh_interval: '10s',
          },
        },
        mappings: {
          _source: {
            mode: 'synthetic',
          },
          properties: {
            'ecs.version': {
              type: 'keyword',
              index: true,
            },
            'Stacktrace.frame.ids': {
              type: 'keyword',
              index: false,
            },
            'Stacktrace.frame.types': {
              type: 'keyword',
              index: false,
            },
          },
        },
      },
    }),
  ]);
}
