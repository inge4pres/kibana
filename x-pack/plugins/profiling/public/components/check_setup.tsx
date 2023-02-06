/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { EuiButton, EuiFlexGroup, EuiFlexItem, EuiLoadingSpinner, EuiText } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import React, { useState } from 'react';
import { AsyncStatus, useAsync } from '../hooks/use_async';
import { useAutoAbortedHttpClient } from '../hooks/use_auto_aborted_http_client';
import { useProfilingDependencies } from './contexts/profiling_dependencies/use_profiling_dependencies';
import { NoDataPage } from './no_data_page';
import { ProfilingAppPageTemplate } from './profiling_app_page_template';

export function CheckSetup({ children }: { children: React.ReactElement }) {
  const {
    services: { fetchHasSetup, postSetupResources },
  } = useProfilingDependencies();

  const [postSetupLoading, setPostSetupLoading] = useState(false);

  const { status, data, error, refresh } = useAsync(
    ({ http }) => {
      return fetchHasSetup({ http });
    },
    [fetchHasSetup]
  );

  const http = useAutoAbortedHttpClient([]);

  const displaySetupScreen =
    (status === AsyncStatus.Settled && data?.has_setup !== true) || !!error;

  const displayNoDataScreen =
    status === AsyncStatus.Settled && data?.has_setup === true && data?.has_data === false;

  const displayUi = data?.has_data === true;

  const docsLink = `https://elastic.github.io/universal-profiling-documentation`;

  const displayLoadingScreen = status !== AsyncStatus.Settled;

  if (displayLoadingScreen) {
    return (
      <ProfilingAppPageTemplate hideSearchBar tabs={[]}>
        <EuiFlexGroup alignItems="center" justifyContent="center">
          <EuiFlexItem grow={false}>
            <EuiLoadingSpinner size="xxl" />
          </EuiFlexItem>
        </EuiFlexGroup>
      </ProfilingAppPageTemplate>
    );
  }

  if (displayUi) {
    return children;
  }

  if (displayNoDataScreen) {
    return <NoDataPage />;
  }

  if (displaySetupScreen) {
    return (
      <ProfilingAppPageTemplate
        tabs={[]}
        noDataConfig={{
          docsLink,
          logo: 'logoObservability',
          pageTitle: i18n.translate('xpack.profiling.noDataConfig.pageTitle', {
            defaultMessage: 'Universal Profiling (now in Beta)',
          }),
          action: {
            elasticAgent: {
              description: (
                <EuiText>
                  {i18n.translate('xpack.profiling.noDataConfig.action.title', {
                    defaultMessage: `Universal Profiling provides fleet-wide, whole-system, continuous profiling with zero instrumentation.
              Understand what lines of code are consuming compute resources, at all times, and across your entire infrastructure.`,
                  })}
                </EuiText>
              ),
              onClick: (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
                event.preventDefault();
              },
              button: (
                <EuiButton
                  disabled={postSetupLoading}
                  onClick={(event) => {
                    event.preventDefault();

                    setPostSetupLoading(true);

                    postSetupResources({ http })
                      .then(() => refresh())
                      .finally(() => {
                        setPostSetupLoading(false);
                      });
                  }}
                  fill
                  isLoading={postSetupLoading}
                >
                  {!postSetupLoading
                    ? i18n.translate('xpack.profiling.noDataConfig.action.buttonLabel', {
                        defaultMessage: 'Setup Universal Profiling',
                      })
                    : i18n.translate('xpack.profiling.noDataConfig.action.buttonLoadingLabel', {
                        defaultMessage: 'Setting up Universal Profiling...',
                      })}
                </EuiButton>
              ),
            },
          },
          solution: i18n.translate('xpack.profiling.noDataConfig.solutionName', {
            defaultMessage: 'Universal Profiling',
          }),
        }}
        hideSearchBar
      >
        <></>
      </ProfilingAppPageTemplate>
    );
  }

  throw new Error('Invalid state');
}
