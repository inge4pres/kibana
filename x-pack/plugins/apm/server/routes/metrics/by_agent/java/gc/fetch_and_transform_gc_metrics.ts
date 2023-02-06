/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { sum, round } from 'lodash';
import { euiLightVars as theme } from '@kbn/ui-theme';
import { kqlQuery, rangeQuery } from '@kbn/observability-plugin/server';
import { ProcessorEvent } from '@kbn/observability-plugin/common';
import { isFiniteNumber } from '../../../../../../common/utils/is_finite_number';
import { getMetricsDateHistogramParams } from '../../../../../lib/helpers/metrics';
import { ChartBase } from '../../../types';

import {
  AGENT_NAME,
  LABEL_NAME,
  METRIC_JAVA_GC_COUNT,
  METRIC_JAVA_GC_TIME,
  SERVICE_NAME,
} from '../../../../../../common/es_fields/apm';
import { getBucketSize } from '../../../../../../common/utils/get_bucket_size';
import { getVizColorForIndex } from '../../../../../../common/viz_colors';
import { JAVA_AGENT_NAMES } from '../../../../../../common/agent_name';
import {
  environmentQuery,
  serviceNodeNameQuery,
} from '../../../../../../common/utils/environment_query';
import { APMConfig } from '../../../../..';
import { APMEventClient } from '../../../../../lib/helpers/create_es_client/create_apm_event_client';

export async function fetchAndTransformGcMetrics({
  environment,
  kuery,
  config,
  apmEventClient,
  serviceName,
  serviceNodeName,
  chartBase,
  fieldName,
  operationName,
  start,
  end,
}: {
  environment: string;
  kuery: string;
  config: APMConfig;
  apmEventClient: APMEventClient;
  serviceName: string;
  serviceNodeName?: string;
  start: number;
  end: number;
  chartBase: ChartBase;
  fieldName: typeof METRIC_JAVA_GC_COUNT | typeof METRIC_JAVA_GC_TIME;
  operationName: string;
}) {
  const { bucketSize } = getBucketSize({ start, end });

  // GC rate and time are reported by the agents as monotonically
  // increasing counters, which means that we have to calculate
  // the delta in an es query. In the future agent might start
  // reporting deltas.
  const params = {
    apm: {
      events: [ProcessorEvent.metric],
    },
    body: {
      track_total_hits: false,
      size: 0,
      query: {
        bool: {
          filter: [
            { term: { [SERVICE_NAME]: serviceName } },
            ...serviceNodeNameQuery(serviceNodeName),
            ...rangeQuery(start, end),
            ...environmentQuery(environment),
            ...kqlQuery(kuery),
            { exists: { field: fieldName } },
            { terms: { [AGENT_NAME]: JAVA_AGENT_NAMES } },
          ],
        },
      },
      aggs: {
        per_pool: {
          terms: {
            field: `${LABEL_NAME}`,
          },
          aggs: {
            timeseries: {
              date_histogram: getMetricsDateHistogramParams({
                start,
                end,
                metricsInterval: config.metricsInterval,
              }),
              aggs: {
                // get the max value
                max: {
                  max: {
                    field: fieldName,
                  },
                },
                // get the derivative, which is the delta y
                derivative: {
                  derivative: {
                    buckets_path: 'max',
                  },
                },
                // if a gc counter is reset, the delta will be >0 and
                // needs to be excluded
                value: {
                  bucket_script: {
                    buckets_path: { value: 'derivative' },
                    script: 'params.value > 0.0 ? params.value : 0.0',
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const response = await apmEventClient.search(operationName, params);

  const { aggregations } = response;

  if (!aggregations) {
    return {
      ...chartBase,
      series: [],
    };
  }

  const series = aggregations.per_pool.buckets.map((poolBucket, i) => {
    const label = poolBucket.key as string;
    const timeseriesData = poolBucket.timeseries;

    const data = timeseriesData.buckets.map((bucket) => {
      // derivative/value will be undefined for the first hit and if the `max` value is null
      const bucketValue = bucket.value?.value;

      const unconvertedY = isFiniteNumber(bucketValue)
        ? round(bucketValue * (60 / bucketSize), 1)
        : null;

      // convert to milliseconds if we're calculating time, but not for rate
      const y =
        unconvertedY !== null && fieldName === METRIC_JAVA_GC_TIME
          ? unconvertedY * 1000
          : unconvertedY;

      return {
        y,
        x: bucket.key,
      };
    });

    const values = data
      .map((coordinate) => coordinate.y)
      .filter((y) => y !== null);

    const overallValue = sum(values) / values.length;

    return {
      title: label,
      key: label,
      type: chartBase.type,
      color: getVizColorForIndex(i, theme),
      overallValue,
      data,
    };
  });

  return {
    ...chartBase,
    series,
  };
}
