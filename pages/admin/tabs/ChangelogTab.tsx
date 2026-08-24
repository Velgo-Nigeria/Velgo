import React, { useState, useEffect } from 'react';

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author: {
    login: string;
    avatar_url: string;
    html_url: string;
  } | null;
  html_url: string;
}

const GITHUB_REPO_OWNER = 'Velgo-Nigeria';
const GITHUB_REPO_NAME = 'velgo';
const GITHUB_DEFAULT_BRANCH = 'main';

// Fallback local changelog in case GitHub rate limits or repo token is pending setup
const FALLBACK_CHANGELOG: Array<{
  sha: string;
  title: string;
  description: string;
  author: string;
  date: string;
  badge: string;
}> = [
  {
    sha: 'c108f9a',
    title: 'Marketplace Security: Emergency Block & Ban Live Filters',
    description: 'Excluded emergency blocked and banned artisan accounts from public hire discovery, category queries, and direct profile routes.',
    author: 'Velgo Engineering',
    date: new Date().toISOString(),
    badge: 'Security & Integrity'
  },
  {
    sha: 'b942e11',
    title: 'Visual Portfolio Showcase & Artisan Image Engine',
    description: 'Added multi-image visual proof portfolios with lightweight browser-side compression tailored for 3G/EDGE Nigerian data savings.',
    author: 'Velgo Engineering',
    date: '2026-08-14T15:30:00Z',
    badge: 'Feature'
  },
  {
    sha: 'a8731d2',
    title: 'Admin Verification Lightbox & Dossier Workspaces',
    description: 'Introduced 360-degree document inspect, zoom/pan controls, and deep activity auditing dossiers.',
    author: 'Velgo Engineering',
    date: '2026-08-10T12:00:00Z',
    badge: 'Admin UX'
  }
];

export const ChangelogTab: React.FC = () => {
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [patToken, setPatToken] = useState<string>(() => {
    return localStorage.getItem('velgo_github_admin_pat') || (import.meta.env.VITE_GITHUB_READ_TOKEN as string) || '';
  });
  const [isCustomTokenOpen, setIsCustomTokenOpen] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [filterQuery, setFilterQuery] = useState<string>('');

  const fetchCommits = async (tokenToUse?: string) => {
    setLoading(true);
    setError(null);

    const token = tokenToUse !== undefined ? tokenToUse : patToken;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (token && token.trim()) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/commits?per_page=30`,
        { headers }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Repository is Private or Not Found. If private, please provide a read-only GitHub Token below.');
        } else if (response.status === 403 || response.status === 429) {
          throw new Error('GitHub API rate limit reached or token requires repo permissions. You can supply a read-only token below.');
        } else {
          throw new Error(`GitHub returned status ${response.status}: ${response.statusText}`);
        }
      }

      const data: GitHubCommit[] = await response.json();
      setCommits(data);
      // Cache in localStorage for offline resiliency
      try {
        localStorage.setItem('velgo_cached_github_commits', JSON.stringify(data));
      } catch (_) {}
    } catch (err: any) {
      console.warn('GitHub commits fetch error:', err.message);
      setError(err.message);

      // Attempt to load from offline cache
      try {
        const cached = localStorage.getItem('velgo_cached_github_commits');
        if (cached) {
          setCommits(JSON.parse(cached));
        }
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommits();
  }, []);

  const handleSaveToken = () => {
    const trimmed = tokenInput.trim();
    localStorage.setItem('velgo_github_admin_pat', trimmed);
    setPatToken(trimmed);
    setIsCustomTokenOpen(false);
    fetchCommits(trimmed);
  };

  const handleClearToken = () => {
    localStorage.removeItem('velgo_github_admin_pat');
    setPatToken('');
    fetchCommits('');
  };

  const filteredCommits = commits.filter((c) => {
    const msg = c.commit.message.toLowerCase();
    const author = (c.commit.author.name || '').toLowerCase();
    const sha = c.sha.toLowerCase();
    const query = filterQuery.toLowerCase();
    return msg.includes(query) || author.includes(query) || sha.includes(query);
  });

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-950 dark:bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-inner">
              <i className="fa-brands fa-github"></i>
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-wider flex items-center gap-2">
                System Changelog & GitHub Releases
                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Live GitHub Sync
                </span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Real-time stream of all features, fixes, and updates pushed to <span className="font-mono font-bold text-slate-700 dark:text-slate-300">Velgo-Nigeria/velgo</span>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchCommits()}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            title="Refresh commit history"
          >
            <i className={`fa-solid fa-arrows-rotate text-[10px] ${loading ? 'animate-spin' : ''}`}></i>
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => {
              setTokenInput(patToken);
              setIsCustomTokenOpen(!isCustomTokenOpen);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              patToken
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
            }`}
          >
            <i className="fa-solid fa-key text-[10px]"></i>
            <span>{patToken ? 'PAT Configured' : 'Configure PAT'}</span>
          </button>

          <a
            href={`https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
            <span className="hidden sm:inline">Open Repo</span>
          </a>
        </div>
      </div>

      {/* Token Modal / Dropdown for Private Repo access */}
      {isCustomTokenOpen && (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-brand/20 dark:border-brand/30 shadow-md space-y-3 animate-fadeIn">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <i className="fa-solid fa-lock text-brand"></i>
              GitHub Token Configuration (For Private Repositories)
            </h4>
            <button
              onClick={() => setIsCustomTokenOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            If <strong>Velgo-Nigeria/velgo</strong> is private, GitHub requires a free, read-only Personal Access Token (PAT).
            It is stored locally on this admin device and will never be shared.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="github_pat_... or ghp_..."
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand"
            />
            <button
              onClick={handleSaveToken}
              className="px-4 py-2 bg-brand text-white text-xs font-black uppercase rounded-xl hover:opacity-90 transition-all shrink-0"
            >
              Save & Test
            </button>
            {patToken && (
              <button
                onClick={handleClearToken}
                className="px-3 py-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl border border-red-200 dark:border-red-800 hover:bg-red-100 transition-all shrink-0"
              >
                Clear Token
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
        <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs"></i>
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter updates by keyword, author, or commit hash..."
          className="bg-transparent border-none outline-none text-xs w-full text-slate-800 dark:text-white placeholder-slate-400"
        />
        {filterQuery && (
          <button onClick={() => setFilterQuery('')} className="text-slate-400 hover:text-slate-600 text-xs">
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </div>

      {/* Error / Private Repo Notice with Helpful Resolution */}
      {error && commits.length === 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 p-5 rounded-2xl space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 text-sm">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                GitHub Repository Access Notice
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                {error}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <p className="font-bold text-slate-800 dark:text-slate-200">
              💡 How to grant read-only access for a private repo:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px]">
              <li>Go to <strong>GitHub.com &gt; Settings &gt; Developer Settings &gt; Personal Access Tokens &gt; Fine-grained tokens</strong>.</li>
              <li>Generate a new token with <strong>Repository access: Velgo-Nigeria/velgo</strong> and permission: <strong>Contents: Read-only</strong>.</li>
              <li>Click <strong>"Configure PAT"</strong> above and paste your token.</li>
            </ol>
          </div>
        </div>
      )}

      {/* Commits List */}
      {loading && commits.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
          <i className="fa-solid fa-circle-notch animate-spin text-3xl text-brand"></i>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Fetching latest deployment stream from GitHub...
          </p>
        </div>
      ) : filteredCommits.length > 0 ? (
        <div className="space-y-2.5">
          {filteredCommits.map((item) => {
            const rawMsg = item.commit.message;
            const lines = rawMsg.split('\n').filter(Boolean);
            const title = lines[0] || 'Update';
            const description = lines.slice(1).join('\n').trim();
            const dateStr = new Date(item.commit.author.date).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            });
            const shortSha = item.sha.substring(0, 7);

            return (
              <div
                key={item.sha}
                className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 p-4 rounded-xl shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 group"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {/* Author Avatar */}
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden mt-0.5">
                    {item.author?.avatar_url ? (
                      <img
                        src={item.author.avatar_url}
                        alt={item.commit.author.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <i className="fa-solid fa-code-commit text-slate-400 text-xs"></i>
                    )}
                  </div>

                  {/* Commit Text */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[9px] font-extrabold px-2 py-0.5 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                        #{shortSha}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {title}
                      </h4>
                    </div>

                    {description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 font-mono whitespace-pre-line leading-relaxed">
                        {description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 font-medium">
                      <span>by <strong className="text-slate-700 dark:text-slate-300">{item.author?.login || item.commit.author.name}</strong></span>
                      <span>•</span>
                      <span>{dateStr}</span>
                    </div>
                  </div>
                </div>

                {/* External GitHub Link */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <a
                    href={item.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 border border-slate-200 dark:border-slate-700 group-hover:border-brand/40"
                  >
                    <span>View Commit</span>
                    <i className="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Fallback offline static changelog if no live API commits */
        <div className="space-y-3">
          <div className="bg-slate-100 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 text-center font-medium">
            Showing platform milestone changelog:
          </div>
          {FALLBACK_CHANGELOG.map((fb) => (
            <div
              key={fb.sha}
              className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 p-4 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  <i className="fa-solid fa-rocket"></i>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] font-extrabold px-2 py-0.5 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                      #{fb.sha}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {fb.title}
                    </h4>
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800">
                      {fb.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {fb.description}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {fb.author} • {new Date(fb.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
