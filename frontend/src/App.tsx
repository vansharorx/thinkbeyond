import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { repositoryApi, getRepositoryIdFromPayload } from './api/repositoryApi';
import './App.css';

const DEFAULT_REPOSITORY_ID = '6418371f-9631-4f9f-aaa7-b6629735f49b';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={`/repositories/${DEFAULT_REPOSITORY_ID}/overview`} replace />} />
        <Route path="/repositories/:id/*" element={<RepositoryWorkspace />} />
      </Routes>
    </BrowserRouter>
  );
}

function RepositoryWorkspace() {
  const { id } = useParams();
  const repositoryId = id ?? DEFAULT_REPOSITORY_ID;
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [repoLabel, setRepoLabel] = useState(repositoryId);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Array<Record<string, unknown>>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const loadLabel = async () => {
      try {
        const overview = await repositoryApi.getOverview(repositoryId);
        if (active) {
          setRepoLabel(overview.repositoryId ?? repositoryId);
        }
      } catch {
        if (active) {
          setRepoLabel(repositoryId);
        }
      }
    };

    void loadLabel();
    return () => {
      active = false;
    };
  }, [repositoryId]);

  const handleRepositoryImport = async () => {
    const value = searchText.trim();
    if (!value) {
      return;
    }

    try {
      const imported = await repositoryApi.importRepository(value);
      const importedId = getRepositoryIdFromPayload(imported) ?? repositoryId;
      if (importedId) {
        navigate(`/repositories/${importedId}/overview`, { replace: true });
      }
    } catch (error) {
      console.error('Repository import failed', error);
    }
  };

  const handleGlobalSearch = async (value: string) => {
    const query = value.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await repositoryApi.search(repositoryId, query, 'all');
      const nextResults = collectSearchResults(response?.results ?? []);
      setSearchResults(nextResults as Array<Record<string, unknown>>);
    } catch (error) {
      console.error('Search failed', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">TB</div>
          <div>
            <h1>ThinkBeyond</h1>
            <p>Repository intelligence</p>
          </div>
        </div>

        <nav className="nav-list" aria-label="Repository navigation">
          <NavLink to={`/repositories/${repositoryId}/overview`} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>Overview</NavLink>
          <NavLink to={`/repositories/${repositoryId}/files`} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>Files</NavLink>
          <NavLink to={`/repositories/${repositoryId}/symbols`} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>Symbols</NavLink>
          <NavLink to={`/repositories/${repositoryId}/dependencies`} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>Dependencies</NavLink>
          <NavLink to={`/repositories/${repositoryId}/impact`} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>Impact</NavLink>
          <NavLink to={`/repositories/${repositoryId}/graph`} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>Graph</NavLink>
          <NavLink to={`/repositories/${repositoryId}/ai`} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>AI Assistant</NavLink>
          <NavLink to={`/repositories/${repositoryId}/investigate`} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>Investigate</NavLink>
        </nav>

        <div className="context-box">
          <p className="eyebrow">Current context</p>
          <div className="context-pill">Repository: {repoLabel}</div>
          {selectedFile ? <div className="context-pill">File: {selectedFile}</div> : null}
          {selectedSymbol ? <div className="context-pill">Symbol: {selectedSymbol}</div> : null}
        </div>
      </aside>

      <main className="content-panel">
        <header className="topbar">
          <div className="repo-header">
            <div className="repo-inline">
              <span className="status-dot" aria-hidden="true" />
              <strong>{repoLabel}</strong>
            </div>
          </div>

          <div className="searchbar">
            <input
              aria-label="Repository search"
              type="text"
              value={searchText}
              placeholder="Search files, symbols, or dependencies"
              onChange={(event) => {
                const nextValue = event.target.value;
                setSearchText(nextValue);
                void handleGlobalSearch(nextValue);
              }}
            />
            <button type="button" onClick={() => void handleRepositoryImport()}>
              Open repo
            </button>
          </div>
        </header>

        {searchText.trim() ? (
          <section className="global-search-panel" aria-live="polite">
            <div className="section-header">
              <h2>Search results</h2>
              {searchLoading ? <span>Loading…</span> : <span>{searchResults.length} matches</span>}
            </div>
            {searchLoading ? (
              <LoadingState label="Searching repository intelligence…" />
            ) : searchResults.length === 0 ? (
              <EmptyState message="No matching repository entities found." />
            ) : (
              <ul className="result-list">
                {searchResults.slice(0, 10).map((item, index) => {
                  const name = stringValue(item.name ?? item.path ?? item.filePath ?? item.type ?? 'Result');
                  const path = stringValue(item.path ?? item.filePath ?? '');
                  const kind = stringValue(item.kind ?? item.type ?? 'entity');
                  return (
                    <li key={`${name}-${path}-${index}`} className="result-item">
                      <div>
                        <strong>{name}</strong>
                        <small>{kind}</small>
                      </div>
                      {path ? <span>{path}</span> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        <Routes>
          <Route path="/" element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPage repositoryId={repositoryId} />} />
          <Route path="files" element={<FilesPage repositoryId={repositoryId} selectedFile={selectedFile} setSelectedFile={setSelectedFile} />} />
          <Route path="symbols" element={<SymbolsPage repositoryId={repositoryId} selectedSymbol={selectedSymbol} setSelectedSymbol={setSelectedSymbol} />} />
          <Route path="dependencies" element={<DependenciesPage repositoryId={repositoryId} />} />
          <Route path="impact" element={<ImpactPage repositoryId={repositoryId} selectedFile={selectedFile} selectedSymbol={selectedSymbol} />} />
          <Route path="graph" element={<GraphPage repositoryId={repositoryId} />} />
          <Route path="ai" element={<AiPage repositoryId={repositoryId} />} />
          <Route path="investigate" element={<InvestigationPage repositoryId={repositoryId} />} />
        </Routes>
      </main>
    </div>
  );
}

function OverviewPage({ repositoryId }: { repositoryId: string }) {
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const data = await repositoryApi.getOverview(repositoryId);
        if (active) {
          setOverview(data as Record<string, unknown>);
          setError(null);
        }
      } catch (caughtError) {
        if (active) {
          setError(caughtError instanceof Error ? caughtError.message : 'Repository overview unavailable.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [repositoryId]);

  if (loading) {
    return <LoadingState label="Loading repository overview…" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!overview) {
    return <EmptyState message="No repository overview available." />;
  }

  const stats = asRecord(overview.repositoryStatistics);
  const healthScore = asRecord(overview.healthScore);
  const largestFiles = asArray(overview.largestFiles);
  const importedFiles = asArray(overview.mostImportedFiles);
  const calledFunctions = asArray(overview.mostCalledFunctions);
  const architecture = asArray(overview.architecture);
  const circular = asArray(overview.circularDependencies);
  const deadCode = asRecord(overview.deadCodeSummary);

  return (
    <div className="page-grid">
      <SectionCard title="Repository overview" subtitle="Current repository intelligence summary">
        <div className="stats-grid">
          <MetricTile label="Files" value={stringValue(stats.totalFiles ?? 'Unavailable')} />
          <MetricTile label="Symbols" value={stringValue(stats.totalSymbols ?? 'Unavailable')} />
          <MetricTile label="Dependencies" value={stringValue(stats.totalDependencies ?? 'Unavailable')} />
          <MetricTile label="Health" value={`${stringValue(healthScore.score ?? 'N/A')} / 100`} />
        </div>
      </SectionCard>

      <SectionCard title="Architecture & health" subtitle="Repository health and structural risk signals">
        <div className="list-grid">
          <div>
            <p className="eyebrow">Health breakdown</p>
            <ul className="bullet-list">
              {Object.entries(asRecord(healthScore.breakdown ?? {})).map(([key, value]) => (
                <li key={key}><strong>{labelize(key)}</strong>: {stringValue(value)}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Architecture</p>
            <ul className="bullet-list">
              {architecture.length > 0 ? architecture.map((item, index) => (
                <li key={`${stringValue(asRecord(item).name ?? 'architecture')}-${index}`}>
                  {stringValue(asRecord(item).name ?? 'Architecture')} — {stringValue(asRecord(item).architecture ?? 'No details')}
                </li>
              )) : <li>Architecture data unavailable.</li>}
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Detected risks" subtitle="High-signal findings from persisted repository analysis">
        <div className="list-grid">
          <div>
            <p className="eyebrow">Circular dependencies</p>
            <ul className="bullet-list">
              {circular.length > 0 ? circular.map((item, index) => (
                <li key={`${stringValue(asRecord(item).workspace ?? 'cycle')}-${index}`}>
                  {stringValue(asRecord(item).workspace ?? 'Workspace')}: {asArray(asRecord(item).cycles).length} cycles
                </li>
              )) : <li>No circular dependencies detected.</li>}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Dead code summary</p>
            <ul className="bullet-list">
              {Object.entries(deadCode).length > 0 ? Object.entries(deadCode).map(([key, value]) => (
                <li key={key}><strong>{labelize(key)}</strong>: {asArray(value).length || 0} items</li>
              )) : <li>No dead-code summary available.</li>}
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Repository hotspots" subtitle="Largest files, import hot spots, and call-heavy functions">
        <div className="list-grid">
          <div>
            <p className="eyebrow">Largest files</p>
            <ul className="bullet-list">
              {largestFiles.length > 0 ? largestFiles.slice(0, 5).map((item, index) => (
                <li key={`${stringValue(asRecord(item).path ?? 'file')}-${index}`}>
                  {stringValue(asRecord(item).path ?? 'Unknown')} — {stringValue(asRecord(item).size ?? 'n/a')} bytes
                </li>
              )) : <li>No files available.</li>}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Most imported files</p>
            <ul className="bullet-list">
              {importedFiles.length > 0 ? importedFiles.slice(0, 5).map((item, index) => (
                <li key={`${stringValue(asRecord(item).path ?? 'import')}-${index}`}>
                  {stringValue(asRecord(item).path ?? 'Unknown')} — {stringValue(asRecord(item).count ?? 0)} imports
                </li>
              )) : <li>No import data available.</li>}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Most called functions</p>
            <ul className="bullet-list">
              {calledFunctions.length > 0 ? calledFunctions.slice(0, 5).map((item, index) => (
                <li key={`${stringValue(asRecord(item).name ?? 'function')}-${index}`}>
                  {stringValue(asRecord(item).name ?? 'Unknown')} — {stringValue(asRecord(item).count ?? 0)} calls
                </li>
              )) : <li>No call statistics available.</li>}
            </ul>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function FilesPage({ repositoryId, selectedFile, setSelectedFile }: { repositoryId: string; selectedFile: string | null; setSelectedFile: (value: string | null) => void; }) {
  const [tree, setTree] = useState<Record<string, unknown> | null>(null);
  const [fileContent, setFileContent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadTree = async () => {
      setLoading(true);
      try {
        const response = await repositoryApi.getTree(repositoryId, '.', true);
        if (active) {
          setTree(response as Record<string, unknown>);
          setError(null);
        }
      } catch (caughtError) {
        if (active) {
          setError(caughtError instanceof Error ? caughtError.message : 'File tree unavailable.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadTree();
    return () => {
      active = false;
    };
  }, [repositoryId]);

  const handleSelect = async (path: string) => {
    setSelectedFile(path);
    try {
      const response = await repositoryApi.getFile(repositoryId, path);
      setFileContent(response as Record<string, unknown>);
    } catch (caughtError) {
      console.error('Could not load file details.', caughtError);
      setFileContent(null);
    }
  };

  if (loading) {
    return <LoadingState label="Loading file explorer…" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="two-column-page">
      <SectionCard title="File explorer" subtitle="Repository hierarchy and quick inspection">
        <div className="tree-view">
          {tree ? renderTree(asRecord(tree.tree ?? {}), selectedFile, handleSelect) : <EmptyState message="Repository tree unavailable." />}
        </div>
      </SectionCard>

      <SectionCard title="File details" subtitle="Selected file context">
        {selectedFile ? (
          <>
            <p className="context-label">{selectedFile}</p>
            <div className="detail-stack">
              {fileContent ? Object.entries(fileContent).slice(0, 12).map(([key, value]) => (
                <div key={key} className="meta-row">
                  <span>{labelize(key)}</span>
                  <strong>{stringValue(value)}</strong>
                </div>
              )) : <EmptyState message="File details have not loaded yet." />}
            </div>
          </>
        ) : (
          <EmptyState message="Select a file to inspect its metadata, imports, and impact." />
        )}
      </SectionCard>
    </div>
  );
}

function SymbolsPage({ repositoryId, selectedSymbol, setSelectedSymbol }: { repositoryId: string; selectedSymbol: string | null; setSelectedSymbol: (value: string | null) => void; }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<Record<string, unknown>>>([]);
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      let active = true;
      const load = async () => {
        setLoading(true);
        try {
          const response = await repositoryApi.search(repositoryId, trimmed, 'symbols');
          if (active) {
            setResults(collectSearchResults(response?.results ?? []) as Array<Record<string, unknown>>);
          }
        } catch (error) {
          console.error('Symbol search failed', error);
          if (active) {
            setResults([]);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

      void load();
      return () => {
        active = false;
      };
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, repositoryId]);

  const handleSelect = async (symbolName: string) => {
    setSelectedSymbol(symbolName);
    try {
      const response = await repositoryApi.getSymbol(repositoryId, symbolName, 'partial');
      setDetails(response as Record<string, unknown>);
    } catch (error) {
      console.error('Could not load symbol details', error);
      setDetails(null);
    }
  };

  return (
    <div className="two-column-page">
      <SectionCard title="Symbol explorer" subtitle="Search for functions, classes, and repository entities">
        <label className="field-label" htmlFor="symbol-search">Search symbols</label>
        <input id="symbol-search" type="text" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. refreshToken, RepositoryOverview" />
        {loading ? <LoadingState label="Loading symbol matches…" /> : null}
        <ul className="entity-list">
          {results.length > 0 ? results.slice(0, 15).map((item, index) => (
            <li key={`${stringValue(item.name ?? item.symbol ?? 'symbol')}-${index}`}>
              <button type="button" className="entity-button" onClick={() => void handleSelect(stringValue(item.name ?? item.symbol ?? ''))}>
                <span>{stringValue(item.name ?? item.symbol ?? 'Unknown symbol')}</span>
                <small>{stringValue(item.kind ?? item.type ?? 'symbol')}</small>
              </button>
            </li>
          )) : <li className="placeholder-row">No matching symbols.</li>}
        </ul>
      </SectionCard>

      <SectionCard title="Symbol details" subtitle="Callers, callees, and impact context">
        {selectedSymbol ? (
          <>
            <p className="context-label">{selectedSymbol}</p>
            <div className="detail-stack">
              {details ? Object.entries(details).slice(0, 20).map(([key, value]) => (
                <div key={key} className="meta-row">
                  <span>{labelize(key)}</span>
                  <strong>{stringValue(value)}</strong>
                </div>
              )) : <EmptyState message="Symbol details are unavailable for this selection." />}
            </div>
          </>
        ) : (
          <EmptyState message="Select a symbol to inspect callers, callees, dependencies, and impact." />
        )}
      </SectionCard>
    </div>
  );
}

function DependenciesPage({ repositoryId }: { repositoryId: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await repositoryApi.getDependencies(repositoryId, { operation: 'overview', includeCycles: true });
        if (active) {
          setData(response as Record<string, unknown>);
          setError(null);
        }
      } catch (caughtError) {
        if (active) {
          setError(caughtError instanceof Error ? caughtError.message : 'Dependency data unavailable.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [repositoryId]);

  if (loading) {
    return <LoadingState label="Loading dependency intelligence…" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!data) {
    return <EmptyState message="Dependency overview unavailable." />;
  }

  const connectivity = asRecord(data.connectivity ?? {});
  const dependencies = asArray(data.dependencies ?? []);
  const dependents = asArray(data.dependents ?? []);
  const cycles = asArray(data.cycles ?? []);

  return (
    <div className="page-grid">
      <SectionCard title="Dependency overview" subtitle="Coupling, dependents, and connectivity">
        <div className="stats-grid compact">
          <MetricTile label="Direct deps" value={stringValue(connectivity.dependencyCount ?? 0)} />
          <MetricTile label="Dependents" value={stringValue(connectivity.dependentCount ?? 0)} />
          <MetricTile label="Total links" value={stringValue(connectivity.totalConnections ?? 0)} />
          <MetricTile label="Cycles" value={stringValue(cycles.length)} />
        </div>
      </SectionCard>

      <SectionCard title="Dependencies" subtitle="Files and modules directly connected to the target">
        {dependencies.length > 0 ? (
          <ul className="bullet-list">
            {dependencies.slice(0, 10).map((item, index) => (
              <li key={`${stringValue(asRecord(item).source ?? 'source')}-${stringValue(asRecord(item).target ?? 'target')}-${index}`}>
                {stringValue(asRecord(item).source ?? 'Source')} → {stringValue(asRecord(item).target ?? 'Target')}
              </li>
            ))}
          </ul>
        ) : <EmptyState message="No direct dependencies found." />}
      </SectionCard>

      <SectionCard title="Dependents" subtitle="Reverse dependency view">
        {dependents.length > 0 ? (
          <ul className="bullet-list">
            {dependents.slice(0, 10).map((item, index) => (
              <li key={`${stringValue(asRecord(item).source ?? 'source')}-${stringValue(asRecord(item).target ?? 'target')}-${index}`}>
                {stringValue(asRecord(item).source ?? 'Source')} → {stringValue(asRecord(item).target ?? 'Target')}
              </li>
            ))}
          </ul>
        ) : <EmptyState message="No dependents were detected." />}
      </SectionCard>
    </div>
  );
}

function ImpactPage({ repositoryId, selectedFile, selectedSymbol }: { repositoryId: string; selectedFile: string | null; selectedSymbol: string | null; }) {
  const [queryFile, setQueryFile] = useState(selectedFile ?? '');
  const [querySymbol, setQuerySymbol] = useState(selectedSymbol ?? '');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQueryFile(selectedFile ?? '');
    setQuerySymbol(selectedSymbol ?? '');
  }, [selectedFile, selectedSymbol]);

  const runImpactCheck = async () => {
    const payload: Record<string, unknown> = {};
    if (queryFile.trim()) {
      payload.filePath = queryFile.trim();
    }
    if (querySymbol.trim()) {
      payload.symbolName = querySymbol.trim();
    }

    if (!payload.filePath && !payload.symbolName) {
      setResult(null);
      return;
    }

    setLoading(true);
    try {
      const response = await repositoryApi.getImpact(repositoryId, payload);
      setResult(response as Record<string, unknown>);
    } catch (error) {
      console.error('Impact analysis failed', error);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-grid compact-grid">
      <SectionCard title="Impact analysis" subtitle="Inspect direct, indirect, and architectural risk">
        <div className="field-stack">
          <label className="field-label" htmlFor="impact-file">File path</label>
          <input id="impact-file" value={queryFile} onChange={(event) => setQueryFile(event.target.value)} placeholder="src/services/auth.service.ts" />
          <label className="field-label" htmlFor="impact-symbol">Symbol name</label>
          <input id="impact-symbol" value={querySymbol} onChange={(event) => setQuerySymbol(event.target.value)} placeholder="refreshToken" />
          <button type="button" className="primary-button" onClick={() => void runImpactCheck()}>Analyze impact</button>
        </div>
      </SectionCard>

      <SectionCard title="Impact result" subtitle="Direct impact, callers, callees, and risk">
        {loading ? <LoadingState label="Analyzing object impact…" /> : null}
        {!loading && result ? (
          <>
            <p className="context-label">Target: {stringValue(asRecord(result.target ?? {}).path ?? 'Unknown')}</p>
            <div className="detail-stack">
              <div className="meta-row"><span>Risk</span><strong>{stringValue(asRecord(asRecord(result.risk ?? {})).level ?? 'Unknown')}</strong></div>
              <div className="meta-row"><span>Direct impact</span><strong>{asArray(asRecord(result).directImpact ?? []).length}</strong></div>
              <div className="meta-row"><span>Indirect impact</span><strong>{asArray(asRecord(result).indirectImpact ?? []).length}</strong></div>
            </div>
          </>
        ) : null}
        {!loading && !result ? <EmptyState message="Provide a file or symbol to inspect impact." /> : null}
      </SectionCard>
    </div>
  );
}

function GraphPage({ repositoryId }: { repositoryId: string }) {
  const [graph, setGraph] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pathTargetId, setPathTargetId] = useState<string>('');
  const [pathResult, setPathResult] = useState<Record<string, unknown> | null>(null);
  const [expandedRoots, setExpandedRoots] = useState<string[]>([]);

  const ROOT_NODE_ID = `repository:${repositoryId}`;
  const MAX_VISIBLE_NODES = 30;
  const MAX_VISIBLE_EDGES = 120;

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      setPathResult(null);
      try {
        const response = await repositoryApi.getGraph(repositoryId, { operation: 'subgraph', nodeId: ROOT_NODE_ID, depth: 2 });
        if (active) {
          const nextGraph = response as Record<string, unknown>;
          setGraph(nextGraph);
          setExpandedRoots([ROOT_NODE_ID]);
          const nextNode = asArray(nextGraph.nodes ?? []).find((node) => stringValue(asRecord(node).id ?? '') === ROOT_NODE_ID) ?? asArray(nextGraph.nodes ?? [])[0] ?? null;
          setSelectedNodeId(nextNode ? stringValue(asRecord(nextNode).id ?? '') : null);
        }
      } catch (caughtError) {
        if (active) {
          setError(caughtError instanceof Error ? caughtError.message : 'Semantic graph unavailable.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [repositoryId]);

  const overview = asRecord(graph?.overview ?? {});
  const allNodes = asArray(graph?.nodes ?? []);
  const allEdges = asArray(graph?.relationships ?? []);
  const visibleNodes = allNodes.slice(0, MAX_VISIBLE_NODES);
  const visibleEdges = allEdges.filter((edge) => {
    const source = stringValue(asRecord(edge).source ?? '');
    const target = stringValue(asRecord(edge).target ?? '');
    return visibleNodes.some((node) => stringValue(asRecord(node).id ?? '') === source || stringValue(asRecord(node).id ?? '') === target);
  }).slice(0, MAX_VISIBLE_EDGES);

  const selectedNode = visibleNodes.find((node) => stringValue(asRecord(node).id ?? '') === selectedNodeId)
    ?? allNodes.find((node) => stringValue(asRecord(node).id ?? '') === selectedNodeId)
    ?? null;

  const availableTargetNodes = visibleNodes.filter((node) => stringValue(asRecord(node).id ?? '') !== selectedNodeId);
  const selectedRelationships = allEdges.filter((edge) => {
    const source = stringValue(asRecord(edge).source ?? '');
    const target = stringValue(asRecord(edge).target ?? '');
    return selectedNode ? source === selectedNodeId || target === selectedNodeId : false;
  }).slice(0, 12);

  const nodePositions = computeGraphLayout(visibleNodes, visibleEdges, ROOT_NODE_ID, selectedNodeId ?? ROOT_NODE_ID);

  const setMergedGraph = (nextData: Record<string, unknown>) => {
    setGraph((previous) => {
      const previousNodes = asArray((previous ?? {}).nodes ?? []);
      const previousEdges = asArray((previous ?? {}).relationships ?? []);
      const mergedNodes = mergeGraphEntries(previousNodes, asArray(nextData.nodes ?? []));
      const mergedEdges = mergeGraphEntries(previousEdges, asArray(nextData.relationships ?? []));
      return {
        ...(previous ?? {}),
        ...nextData,
        nodes: mergedNodes,
        relationships: mergedEdges,
      } as Record<string, unknown>;
    });
  };

  const handleInspectNeighbors = async () => {
    if (!selectedNode) {
      return;
    }

    try {
      setLoading(true);
      const response = await repositoryApi.getGraph(repositoryId, { operation: 'neighbors', nodeId: selectedNodeId ?? selectedNode.id });
      setMergedGraph(response as Record<string, unknown>);
      setPathResult(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Neighbor lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleExpandSubgraph = async () => {
    if (!selectedNode) {
      return;
    }

    if (expandedRoots.includes(selectedNodeId ?? '')) {
      return;
    }

    try {
      setLoading(true);
      const response = await repositoryApi.getGraph(repositoryId, { operation: 'subgraph', nodeId: selectedNodeId ?? selectedNode.id, depth: 2 });
      setMergedGraph(response as Record<string, unknown>);
      setExpandedRoots((previous) => previous.includes(selectedNodeId ?? '') ? previous : [...previous, selectedNodeId ?? '']);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Graph expansion failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleFindPath = async () => {
    if (!selectedNode || !pathTargetId) {
      return;
    }

    try {
      setLoading(true);
      const response = await repositoryApi.getGraph(repositoryId, { operation: 'path', from: selectedNodeId ?? selectedNode.id, to: pathTargetId });
      setPathResult(response as Record<string, unknown>);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Path lookup failed.');
      setPathResult(null);
    } finally {
      setLoading(false);
    }
  };

  const pathData = asRecord(pathResult?.path ?? {});
  const pathNodes = asArray(pathData.path ?? []);
  const pathRelationships = asArray(pathData.relationships ?? []);
  const pathFound = booleanValue(pathData.found ?? false);

  if (loading && !graph) {
    return <LoadingState label="Loading semantic graph…" />;
  }

  if (error && !graph) {
    return <ErrorState message={error} />;
  }

  const overviewStats = asRecord(graph?.overview ?? overview ?? {});
  const totalNodes = Number(overviewStats.nodeCount ?? allNodes.length ?? 0);
  const totalEdges = Number(overviewStats.edgeCount ?? allEdges.length ?? 0);

  return (
    <div className="page-grid graph-layout">
      <SectionCard title="Semantic graph overview" subtitle="Actual repository graph data, bounds, and interactions">
        <div className="stats-grid compact">
          <MetricTile label="Nodes" value={stringValue(totalNodes)} />
          <MetricTile label="Edges" value={stringValue(totalEdges)} />
          <MetricTile label="Visible" value={stringValue(visibleNodes.length)} />
          <MetricTile label="Workspaces" value={stringValue(overviewStats.workspaceCount ?? 0)} />
        </div>
        <div className="graph-toolbar">
          <button type="button" className="primary-button" onClick={() => setSelectedNodeId(ROOT_NODE_ID)}>
            Center repository
          </button>
          <button type="button" className="primary-button" onClick={() => void handleInspectNeighbors()} disabled={!selectedNode}>
            Inspect neighbors
          </button>
          <button type="button" className="primary-button" onClick={() => void handleExpandSubgraph()} disabled={!selectedNode}>
            Expand selected node
          </button>
        </div>

        <div className="graph-status-row">
          <span>{visibleNodes.length >= MAX_VISIBLE_NODES ? `Showing first ${MAX_VISIBLE_NODES} nodes` : `Showing ${visibleNodes.length} nodes`}</span>
          <span>{visibleEdges.length >= MAX_VISIBLE_EDGES ? `Edges truncated to ${MAX_VISIBLE_EDGES}` : `${visibleEdges.length} relationships`}</span>
        </div>

        <div className="graph-canvas-wrap">
          {visibleNodes.length === 0 ? (
            <EmptyState message="No graph nodes were returned for this repository." />
          ) : (
            <svg viewBox={`0 0 ${nodePositions.width} ${nodePositions.height}`} className="graph-svg" role="img" aria-label="Repository semantic graph">
              {visibleEdges.map((edge, index) => {
                const sourceId = stringValue(asRecord(edge).source ?? '');
                const targetId = stringValue(asRecord(edge).target ?? '');
                const sourcePos = nodePositions.positions.get(sourceId);
                const targetPos = nodePositions.positions.get(targetId);
                const edgeType = stringValue(asRecord(edge).type ?? 'related_to');

                if (!sourcePos || !targetPos) {
                  return null;
                }

                const midX = (sourcePos.x + targetPos.x) / 2;
                const midY = (sourcePos.y + targetPos.y) / 2;

                return (
                  <g key={`${sourceId}-${targetId}-${edgeType}-${index}`}>
                    <line x1={sourcePos.x} y1={sourcePos.y} x2={targetPos.x} y2={targetPos.y} className="graph-edge" />
                    <text x={midX} y={midY - 8} className="graph-edge-label">{edgeType}</text>
                  </g>
                );
              })}

              {visibleNodes.map((node) => {
                const nodeId = stringValue(asRecord(node).id ?? '');
                const position = nodePositions.positions.get(nodeId);
                if (!position) {
                  return null;
                }

                const nodeType = stringValue(asRecord(node).type ?? 'node');
                const label = shortenLabel(stringValue(asRecord(node).label ?? asRecord(node).path ?? nodeId));
                const isSelected = selectedNodeId === nodeId;

                return (
                  <g key={nodeId} onClick={() => setSelectedNodeId(nodeId)} className={isSelected ? 'graph-node selected' : 'graph-node'}>
                    <rect
                      x={position.x - 44}
                      y={position.y - 18}
                      width={88}
                      height={36}
                      rx={14}
                      className={`graph-node-box ${nodeType}`}
                    />
                    <text x={position.x} y={position.y + 5} textAnchor="middle" className="graph-node-label">{label}</text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Selected node" subtitle="Stable backend node identity and relationship details">
        {selectedNode ? (
          <div className="detail-stack">
            <div className="meta-row"><span>Type</span><strong>{stringValue(asRecord(selectedNode).type ?? 'Unknown')}</strong></div>
            <div className="meta-row"><span>Identifier</span><strong>{stringValue(asRecord(selectedNode).id ?? 'Unknown')}</strong></div>
            <div className="meta-row"><span>Label</span><strong>{stringValue(asRecord(selectedNode).label ?? asRecord(selectedNode).path ?? 'Unknown')}</strong></div>
            <div className="meta-row"><span>Workspace</span><strong>{stringValue(asRecord(selectedNode).workspace ?? 'Repository')}</strong></div>
            <div className="meta-row"><span>Path</span><strong>{stringValue(asRecord(selectedNode).path ?? 'N/A')}</strong></div>
            <label className="field-label" htmlFor="graph-path-target">Find a path</label>
            <select id="graph-path-target" className="graph-select" value={pathTargetId} onChange={(event) => setPathTargetId(event.target.value)}>
              <option value="">Select target node</option>
              {availableTargetNodes.map((node) => (
                <option key={stringValue(asRecord(node).id ?? '')} value={stringValue(asRecord(node).id ?? '')}>
                  {stringValue(asRecord(node).label ?? asRecord(node).path ?? asRecord(node).id ?? '')}
                </option>
              ))}
            </select>
            <button type="button" className="primary-button" onClick={() => void handleFindPath()} disabled={!selectedNode || !pathTargetId}>
              Find path
            </button>
            <div className="relationship-stack">
              <p className="eyebrow">Relationships</p>
              {selectedRelationships.length > 0 ? (
                <ul className="bullet-list">
                  {selectedRelationships.map((edge, index) => {
                    const edgeData = asRecord(edge);
                    const sourceId = stringValue(edgeData.source ?? '');
                    const targetId = stringValue(edgeData.target ?? '');
                    const otherId = sourceId === selectedNodeId ? targetId : sourceId;
                    const otherNode = allNodes.find((node) => stringValue(asRecord(node).id ?? '') === otherId);
                    return (
                      <li key={`${sourceId}-${targetId}-${stringValue(edgeData.type ?? 'related')}-${index}`}>
                        <strong>{stringValue(edgeData.type ?? 'related')}</strong> → {stringValue(otherNode ? (asRecord(otherNode).label ?? asRecord(otherNode).path ?? otherId) : otherId)}
                      </li>
                    );
                  })}
                </ul>
              ) : <span className="placeholder-row">No relationships were returned for this node.</span>}
            </div>
          </div>
        ) : (
          <EmptyState message="Select a graph node to inspect details and relationships." />
        )}
      </SectionCard>

      <SectionCard title="Path inspection" subtitle="Use the backend graph path API to trace connections between nodes">
        {!pathResult ? (
          <EmptyState message="Choose a target node to inspect a path using the real graph API." />
        ) : (
          <div className="detail-stack">
            <div className="meta-row"><span>Status</span><strong>{pathFound ? 'Path found' : 'No connected path'}</strong></div>
            <div className="meta-row"><span>Length</span><strong>{stringValue(pathData.length ?? pathNodes.length ?? 0)}</strong></div>
            {pathFound ? (
              <>
                <p className="eyebrow">Path nodes</p>
                <ul className="bullet-list">
                  {pathNodes.map((node, index) => (
                    <li key={`${stringValue(asRecord(node).id ?? 'path-node')}-${index}`}>
                      {stringValue(asRecord(node).label ?? asRecord(node).path ?? asRecord(node).id ?? 'Unknown')}
                    </li>
                  ))}
                </ul>
                <p className="eyebrow">Path relationships</p>
                <ul className="bullet-list">
                  {pathRelationships.length > 0 ? pathRelationships.map((edge, index) => (
                    <li key={`${stringValue(asRecord(edge).source ?? 'source')}-${stringValue(asRecord(edge).target ?? 'target')}-${index}`}>
                      {stringValue(asRecord(edge).type ?? 'related')} ({stringValue(asRecord(edge).source ?? '')} → {stringValue(asRecord(edge).target ?? '')})
                    </li>
                  )) : <li>No path edges returned.</li>}
                </ul>
              </>
            ) : (
              <p className="placeholder-row">There is no connected path between the selected nodes in the current graph view.</p>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function AiPage({ repositoryId }: { repositoryId: string }) {
  const location = useLocation();
  const [question, setQuestion] = useState('How does authentication work?');
  const [answer, setAnswer] = useState<Record<string, unknown> | null>(null);
  const [investigation, setInvestigation] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const queryFromRoute = new URLSearchParams(location.search).get('q');
    if (queryFromRoute) {
      setQuestion(queryFromRoute);
    }
  }, [location.search]);

  const askQuestion = async () => {
    if (!question.trim()) {
      return;
    }

    setLoading(true);
    try {
      const [answerResult, investigationResult] = await Promise.all([
        repositoryApi.answer(repositoryId, question.trim()),
        repositoryApi.investigate(repositoryId, question.trim()),
      ]);
      setAnswer(answerResult as Record<string, unknown>);
      setInvestigation(investigationResult as Record<string, unknown>);
    } catch (error) {
      console.error('AI question failed', error);
      setAnswer(null);
      setInvestigation(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-grid">
      <SectionCard title="AI assistant" subtitle="Ask repository-aware questions using persisted intelligence">
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} placeholder="What should I inspect before changing refreshToken?" />
        <button type="button" className="primary-button" onClick={() => void askQuestion()}>
          Ask repository
        </button>
      </SectionCard>

      <SectionCard title="Grounded answer" subtitle="Evidence-backed reasoning and uncertainty">
        {loading ? <LoadingState label="Running repository intelligence…" /> : null}
        {!loading && answer ? (
          <>
            <div className="status-row">
              <StatusBadge tone={booleanValue(answer.grounded) ? 'success' : 'warning'}>
                {booleanValue(answer.grounded) ? 'Grounded' : 'Not authoritative'}
              </StatusBadge>
              <StatusBadge tone={booleanValue(asRecord(answer.grounding ?? {}).ambiguous) ? 'warning' : 'neutral'}>
                {booleanValue(asRecord(answer.grounding ?? {}).ambiguous) ? 'Ambiguous' : 'Unambiguous'}
              </StatusBadge>
              <StatusBadge tone={booleanValue(asRecord(answer.metadata ?? {}).evidenceSufficient) ? 'success' : 'warning'}>
                {booleanValue(asRecord(answer.metadata ?? {}).evidenceSufficient) ? 'Sufficient evidence' : 'Insufficient evidence'}
              </StatusBadge>
            </div>
            <p className="answer-text">{stringValue(answer.answer ?? 'No answer returned.')}</p>
            <div className="detail-stack">
              {asArray(answer.findings ?? []).length > 0 ? asArray(answer.findings ?? []).map((item, index) => (
                <div key={`${stringValue(item)}-${index}`} className="meta-row"><span>Finding</span><strong>{stringValue(item)}</strong></div>
              )) : null}
              {asArray(answer.sources ?? []).length > 0 ? asArray(answer.sources ?? []).map((item, index) => (
                <div key={`${stringValue(item)}-${index}`} className="meta-row"><span>Source</span><strong>{stringValue(item)}</strong></div>
              )) : null}
            </div>
          </>
        ) : !loading ? <EmptyState message="Ask a repository question to receive grounded or insufficient-evidence guidance." /> : null}
      </SectionCard>

      <SectionCard title="Investigation summary" subtitle="Follow-up recommendations from the investigation engine">
        {investigation ? (
          <>
            <p className="context-label">Intent: {stringValue(investigation.intent ?? 'Repository investigation')}</p>
            <ul className="bullet-list">
              {asArray(investigation.recommendations ?? []).length > 0 ? asArray(investigation.recommendations ?? []).map((item, index) => (
                <li key={`${stringValue(asRecord(item).title ?? 'recommendation')}-${index}`}>
                  {stringValue(asRecord(item).title ?? 'Recommendation')}: {stringValue(asRecord(item).summary ?? 'No summary provided.')}
                </li>
              )) : <li>No recommendations returned.</li>}
            </ul>
          </>
        ) : <EmptyState message="Investigation output will appear here after the first query." />}
      </SectionCard>
    </div>
  );
}

function InvestigationPage({ repositoryId }: { repositoryId: string }) {
  const [query, setQuery] = useState('What should I inspect before changing refreshToken?');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const runInvestigation = async () => {
    if (!query.trim()) {
      return;
    }

    setLoading(true);
    try {
      const response = await repositoryApi.investigate(repositoryId, query.trim());
      setResult(response as Record<string, unknown>);
    } catch (error) {
      console.error('Investigation failed', error);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-grid">
      <SectionCard title="Investigation" subtitle="Repository-guided change plan and review flow">
        <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={4} />
        <button type="button" className="primary-button" onClick={() => void runInvestigation()}>Investigate</button>
      </SectionCard>

      <SectionCard title="Investigation result" subtitle="Recommender steps, findings, and source references">
        {loading ? <LoadingState label="Running repository investigation…" /> : null}
        {!loading && result ? (
          <>
            <p className="context-label">Intent: {stringValue(result.intent ?? 'Repository investigation')}</p>
            <div className="detail-stack">
              <div className="meta-row"><span>Confidence</span><strong>{stringValue(result.confidence ?? 'unknown')}</strong></div>
              <div className="meta-row"><span>Findings</span><strong>{asArray(result.findings ?? []).length}</strong></div>
            </div>
            <ul className="bullet-list">
              {asArray(result.plan ?? []).map((item, index) => (
                <li key={`${stringValue(asRecord(item).id ?? 'plan')}-${index}`}>
                  {stringValue(asRecord(item).operation ?? 'Step')} — {stringValue(asRecord(item).reason ?? 'Investigation step')}
                </li>
              ))}
            </ul>
          </>
        ) : !loading ? <EmptyState message="Run an investigation to evaluate the likely hotspots before a change." /> : null}
      </SectionCard>
    </div>
  );
}

function mergeGraphEntries(previousEntries: Array<Record<string, unknown>>, nextEntries: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const merged = new Map<string, Record<string, unknown>>();

  for (const entry of previousEntries) {
    const key = stringValue(asRecord(entry).id ?? asRecord(entry).label ?? asRecord(entry).path ?? JSON.stringify(entry));
    if (key) {
      merged.set(key, entry);
    }
  }

  for (const entry of nextEntries) {
    const key = stringValue(asRecord(entry).id ?? asRecord(entry).label ?? asRecord(entry).path ?? JSON.stringify(entry));
    if (key) {
      merged.set(key, entry);
    }
  }

  return [...merged.values()];
}

function computeGraphLayout(nodes: Array<Record<string, unknown>>, edges: Array<Record<string, unknown>>, rootId: string, selectedNodeId: string | null) {
  const basePositions = new Map<string, { x: number; y: number }>();
  const rootNode = nodes.find((node) => stringValue(asRecord(node).id ?? '') === rootId) ?? nodes[0] ?? null;

  if (!rootNode) {
    return { width: 720, height: 360, positions: basePositions };
  }

  const rootKey = stringValue(asRecord(rootNode).id ?? '');
  const queue: Array<{ id: string; level: number }> = [{ id: rootKey, level: 0 }];
  const visited = new Set<string>([rootKey]);
  const distances = new Map<string, number>([[rootKey, 0]]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const currentEdges = edges.filter((edge) => {
      const source = stringValue(asRecord(edge).source ?? '');
      const target = stringValue(asRecord(edge).target ?? '');
      return source === current.id || target === current.id;
    });

    for (const edge of currentEdges) {
      const source = stringValue(asRecord(edge).source ?? '');
      const target = stringValue(asRecord(edge).target ?? '');
      const nextId = source === current.id ? target : source;
      if (nextId && !visited.has(nextId)) {
        visited.add(nextId);
        distances.set(nextId, current.level + 1);
        queue.push({ id: nextId, level: current.level + 1 });
      }
    }
  }

  const grouped = new Map<number, string[]>();
  nodes.forEach((node) => {
    const nodeId = stringValue(asRecord(node).id ?? '');
    const depth = distances.get(nodeId) ?? 0;
    const layer = grouped.get(depth) ?? [];
    layer.push(nodeId);
    grouped.set(depth, layer);
  });

  let maxDepth = 0;
  let maxLayerLength = 0;
  grouped.forEach((value, depth) => {
    maxDepth = Math.max(maxDepth, depth);
    maxLayerLength = Math.max(maxLayerLength, value.length);
  });

  const sortedDepths = [...grouped.keys()].sort((left, right) => left - right);
  sortedDepths.forEach((depth) => {
    const ids = grouped.get(depth) ?? [];
    ids.sort((left, right) => {
      const leftNode = nodes.find((node) => stringValue(asRecord(node).id ?? '') === left) ?? {};
      const rightNode = nodes.find((node) => stringValue(asRecord(node).id ?? '') === right) ?? {};
      return stringValue(asRecord(leftNode).label ?? asRecord(leftNode).path ?? left).localeCompare(stringValue(asRecord(rightNode).label ?? asRecord(rightNode).path ?? right));
    });

    ids.forEach((id, index) => {
      const x = 120 + depth * 220;
      const y = 80 + index * 72;
      basePositions.set(id, { x, y });
    });
  });

  if (basePositions.size === 0) {
    return { width: 720, height: 360, positions: basePositions };
  }

  const width = Math.max(720, 120 + (maxDepth + 2) * 220);
  const height = Math.max(360, 80 + (maxLayerLength + 1) * 72);

  if (selectedNodeId && !basePositions.has(selectedNodeId)) {
    const selectedNode = nodes.find((node) => stringValue(asRecord(node).id ?? '') === selectedNodeId);
    if (selectedNode) {
      const selectedNodeIdValue = stringValue(asRecord(selectedNode).id ?? '');
      if (!basePositions.has(selectedNodeIdValue)) {
        basePositions.set(selectedNodeIdValue, { x: 120 + maxDepth * 220, y: 90 });
      }
    }
  }

  return { width, height, positions: basePositions };
}

function shortenLabel(value: string, maxLength = 18): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="panel-card">
      <div className="section-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ tone, children }: { tone: 'success' | 'warning' | 'neutral'; children: React.ReactNode }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}

function LoadingState({ label }: { label: string }) {
  return <div className="empty-state"><p>{label}</p></div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="empty-state error"><p>{message}</p></div>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="empty-state"><p>{message}</p></div>;
}

function renderTree(node: Record<string, unknown>, selectedFile: string | null, onSelect: (path: string) => void): React.ReactNode {
  const name = stringValue(node.name ?? node.path ?? 'unknown');
  const type = stringValue(node.type ?? 'directory');
  const path = stringValue(node.path ?? name);
  const children = asArray(node.children ?? []);

  return (
    <div className="tree-node" key={path}>
      <button
        type="button"
        className={selectedFile === path ? 'tree-item selected' : 'tree-item'}
        onClick={() => {
          if (type === 'file') {
            onSelect(path);
          }
        }}
      >
        <span>{type === 'file' ? '📄' : '📁'}</span>
        <span>{name}</span>
      </button>
      {children.length > 0 ? (
        <div className="tree-children">
          {children.map((child) => renderTree(asRecord(child), selectedFile, onSelect))}
        </div>
      ) : null}
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value as Array<Record<string, unknown>>;
  }
  return [];
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(stringValue).join(', ') : '[]';
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value ? String(value) : 'Unavailable';
}

function labelize(value: string): string {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (first) => first.toUpperCase());
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 'true';
}

function collectSearchResults(input: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(input)) {
    return input as Array<Record<string, unknown>>;
  }

  if (!input || typeof input !== 'object') {
    return [];
  }

  const entries = Object.values(input as Record<string, unknown>);
  const flattened = entries.flatMap((entry) => {
    if (Array.isArray(entry)) {
      return entry as Array<Record<string, unknown>>;
    }
    return [];
  });

  return flattened.filter((entry) => typeof entry === 'object' && entry !== null);
}

export default App;
