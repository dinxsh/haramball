import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  BadgeDollarSign,
  Bell,
  Check,
  ChevronDown,
  Clock3,
  Coins,
  Compass,
  Flame,
  Gauge,
  Globe,
  Lock,
  Medal,
  Palette,
  Plus,
  Settings,
  ShieldCheck,
  Trophy,
  UserCircle,
  UserPlus,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import {
  createBentoMarketDraft,
  createBentoWalletLink,
  createManagedTournament,
  createPrivateGroup,
  deleteManagedTournament,
  estimateBentoBet,
  exchangeBentoWalletCode,
  extractEstimate,
  fetchBentoFeeds,
  fetchBentoMarket,
  fetchBentoMarketAnalytics,
  fetchBentoMarkets,
  fetchBentoPortfolio,
  fetchBentoReadiness,
  fetchBentoUserShares,
  fetchLeaderboardUsers,
  fetchManagedTournaments,
  fetchPrivateGroups,
  fixtureFromMarket,
  humanToBaseUnits,
  initialBentoReadiness,
  isBentoMarketEnded,
  leaderboardRows,
  leaderboardSummary,
  loginBentoWallet,
  invitePrivateGroup,
  joinPrivateGroup,
  marketResultSummary,
  marketIndexFromDuelId,
  marketDepthRows,
  marketDetailMetrics,
  marketOutcomeRows,
  marketPriceHistory,
  normalizeExternalLogin,
  normalizeBentoLogin,
  placeBentoBet,
  portfolioPositions,
  portfolioSummary,
  saveLeaderboardUser,
  shortAddress,
  tokenDecimalsFromMarket,
  managedTournamentRows,
  updateManagedTournament,
  weiToHuman,
} from "./bento";
import ExplorerModal from "./ExplorerModal.jsx";
import TournamentPage, { TournamentDialog } from "./TournamentPage.jsx";
import {
  buildLiveCentreRows,
  fetchExplorerItems,
  filterLiveCentreRows,
  formatExplorerDate,
  formatExplorerPrize,
  LIVE_CENTRE_LEAGUES,
  LIVE_CENTRE_SPORTS,
  liveCentreStats,
  tournamentSlugFromPath,
} from "./explorer.js";
import "./styles.css";

const formatMoney = (value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "0.00");
const DEFAULT_PROFILES = [];
const PROFILE_STORAGE_KEY = "haramball-world-cup-profiles";
const ACTIVE_PROFILE_STORAGE_KEY = "haramball-active-profile-id";
const ACTIVITY_STORAGE_KEY = "haramball-activity-feed";
const THEME_STORAGE_KEY = "haramball-theme";
const SESSION_TOKEN_STORAGE_KEY = "haramball-session-token";
const SESSION_WALLET_STORAGE_KEY = "haramball-session-wallet";
const SESSION_ACCOUNT_STORAGE_KEY = "haramball-session-account";
const PRIVATE_GROUP_STORAGE_KEY = "haramball-private-groups";
const ROUND_SECONDS = 15;
const LOCKOUT_SECONDS = Math.ceil(ROUND_SECONDS * 0.15);
const MIN_BENTO_STAKE = 5;
const TOKEN_OPTIONS = [
  { symbol: "USDC", name: "USD Coin", network: "Base", icon: "$" },
];
const MARKET_CATEGORIES = ["Cricket", "Football", "Basketball", "Hockey", "Formula 1", "American Football", "Baseball", "Tennis", "Esports", "Rugby"];
const TEAM_FLAGS = {
  Argentina: "\u{1F1E6}\u{1F1F7}",
  Brazil: "\u{1F1E7}\u{1F1F7}",
  England: "\u{1F3F4}",
  France: "\u{1F1EB}\u{1F1F7}",
  Germany: "\u{1F1E9}\u{1F1EA}",
  Japan: "\u{1F1EF}\u{1F1F5}",
  Morocco: "\u{1F1F2}\u{1F1E6}",
  USA: "\u{1F1FA}\u{1F1F8}",
};
function MarketApp() {
  const [readiness, setReadiness] = useState(initialBentoReadiness);
  const [markets, setMarkets] = useState([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketError, setMarketError] = useState("");
  const [marketIndex, setMarketIndex] = useState(0);
  const [wallet, setWallet] = useState("");
  const [token, setToken] = useState("");
  const [authMode, setAuthMode] = useState("");
  const [managedAccount, setManagedAccount] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [walletOptions, setWalletOptions] = useState([]);
  const [walletOptionsLoading, setWalletOptionsLoading] = useState(true);
  const [stake, setStake] = useState(String(MIN_BENTO_STAKE));
  const [stakeCurrency, setStakeCurrency] = useState("USDC");
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenSearch, setTokenSearch] = useState("");
  const [pick, setPick] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [marketAnalytics, setMarketAnalytics] = useState(null);
  const [marketAnalyticsError, setMarketAnalyticsError] = useState("");
  const [userShares, setUserShares] = useState(null);
  const [profiles, setProfiles] = useState(loadProfiles);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [activeProfileId, setActiveProfileId] = useState(() => localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || "");
  const [profileDraft, setProfileDraft] = useState({ name: "", username: "", team: "USA", style: "Striker", twitter: "", discord: "" });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState([]);
  const [profileModalOpen, setProfileModalOpen] = useState(() => !localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY));
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [activeTournamentSlug, setActiveTournamentSlug] = useState("");
  const [privateGroups, setPrivateGroups] = useState(loadPrivateGroups);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupMode, setGroupMode] = useState("create");
  const [groupDraft, setGroupDraft] = useState({ name: "", invite: "", code: "" });
  const [activeGroupId, setActiveGroupId] = useState("");
  const [marketCreatorOpen, setMarketCreatorOpen] = useState(false);
  const [marketCreating, setMarketCreating] = useState(false);
  const [marketDraft, setMarketDraft] = useState(defaultMarketDraft);
  const [profileMode, setProfileMode] = useState("onboarding");
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || "classic");
  const [toast, setToast] = useState("");
  const [feed, setFeed] = useState(loadActivityFeed);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => Math.floor(Date.now() / 1000) % ROUND_SECONDS);
  const [roundKey, setRoundKey] = useState(() => Math.floor(Date.now() / 1000 / ROUND_SECONDS));
  const [autoPick, setAutoPick] = useState(null);
  const [settlement, setSettlement] = useState({
    tone: "idle",
    icon: "?",
    title: "Ready for your pick",
    body: "Pick a side to preview the ticket before locking it.",
    payout: "--",
    receipt: null,
  });
  const reconcileTimer = useRef(null);
  const explorerButtonRef = useRef(null);
  const estimateRequestRef = useRef(0);

  const market = markets[marketIndex] || null;
  const marketEnded = isBentoMarketEnded(market);
  const tokenDecimals = tokenDecimalsFromMarket(market);
  const amountWei = useMemo(() => humanToBaseUnits(stake, tokenDecimals), [stake, tokenDecimals]);
  const finalResult = useMemo(() => marketResultSummary(market), [market]);
  const authed = Boolean(token && authMode === "wallet");
  const optionLabel = pick === 0 ? market?.optionA : pick === 1 ? market?.optionB : autoPick?.label || "";
  const secondsRemaining = Math.max(0, ROUND_SECONDS - elapsedSeconds);
  const lockoutActive = secondsRemaining <= LOCKOUT_SECONDS;
  const progressPercent = Math.min(100, Math.max(0, (elapsedSeconds / ROUND_SECONDS) * 100));
  const marketTitle = market?.title || (readiness.configured ? "No match markets returned" : "Market board needs setup");
  const marketBoardLoading = marketsLoading && !market;
  const displayedMarketTitle = marketBoardLoading ? "Opening Explorer" : marketEnded ? "Explore active tournaments" : marketTitle;
  const displayedMarketBody = marketBoardLoading
    ? "The verified tournament calendar is opening while the match board refreshes."
    : marketEnded
      ? "Open verified Bento tournaments, create a market, or invite a private group from the same home screen."
      : "One random side is chosen for a strict 15-second window.";
  const marketBody = market
    ? "Preview your ticket, then lock it in."
    : readiness.configured
      ? "Try again when the live market board is available."
      : "Add the server market key, then restart the app to load live match markets.";
  const fixture = useMemo(() => fixtureFromMarket(market), [market]);
  const leagueName = leagueFromMarket(market);
  const selectedToken = TOKEN_OPTIONS.find((item) => item.symbol === stakeCurrency) || TOKEN_OPTIONS[0];
  const leaderboard = useMemo(
    () => dedupeProfiles(profiles).sort((a, b) => b.wins - a.wins || a.losses - b.losses).slice(0, 5),
    [profiles],
  );
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  const activeGroup = privateGroups.find((group) => group.id === activeGroupId) || privateGroups[0] || null;
  const profileRouteUsername = usernameFromProfilePath();
  const routeProfile = profileRouteUsername
    ? dedupeProfiles(profiles).find((profile) => usernameFrom(profile.username || profile.name) === profileRouteUsername)
    : null;
  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 1800);
  };
  const notifications = useMemo(
    () => feed.map((item, index) => ({
      id: `${item.minute}-${item.label}-${index}`,
      ...item,
    })),
    [feed],
  );
  const unreadCount = notifications.filter((item) => !readNotificationIds.includes(item.id)).length;
  const markNotificationsRead = () => {
    setReadNotificationIds(notifications.map((item) => item.id));
  };
  const closeExplorer = () => {
    setExplorerOpen(false);
    window.requestAnimationFrame(() => explorerButtonRef.current?.focus());
  };
  const openLiveExplore = () => setExplorerOpen(true);
  const enterTournamentFromExplorer = (slug) => {
    if (!slug) return;
    setActiveTournamentSlug(slug);
    setExplorerOpen(false);
  };

  useEffect(() => {
    setExplorerOpen(true);
  }, []);

  useEffect(() => {
    if (token) sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    else sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
  }, [token]);

  useEffect(() => {
    if (wallet) sessionStorage.setItem(SESSION_WALLET_STORAGE_KEY, wallet);
    else sessionStorage.removeItem(SESSION_WALLET_STORAGE_KEY);
  }, [wallet]);

  useEffect(() => {
    if (managedAccount) sessionStorage.setItem(SESSION_ACCOUNT_STORAGE_KEY, managedAccount);
    else sessionStorage.removeItem(SESSION_ACCOUNT_STORAGE_KEY);
  }, [managedAccount]);

  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(feed));
  }, [feed]);

  useEffect(() => {
    localStorage.setItem(PRIVATE_GROUP_STORAGE_KEY, JSON.stringify(privateGroups));
  }, [privateGroups]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      setElapsedSeconds(nowSeconds % ROUND_SECONDS);
      setRoundKey(Math.floor(nowSeconds / ROUND_SECONDS));
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!market || marketEnded) {
      setAutoPick(null);
      return;
    }

    const nextPick = chooseRandomPick(market);
    setAutoPick(nextPick);
    setPick(nextPick.index);
    setEstimate(null);
    setSettlement({
      tone: nextPick.index === 0 ? "yes" : "no",
      icon: nextPick.index === 0 ? "Y" : "N",
      title: `${nextPick.label} auto-selected`,
      body: `Randomly assigned for this 15-second round. Preview updates automatically.`,
      payout: "Ready",
      receipt: null,
    });
  }, [market?.duelId, marketEnded, roundKey]);

  useEffect(() => {
    if (!market || marketEnded || !autoPick) return undefined;

    setEstimate(null);
    if (!authed || Number(stake) < MIN_BENTO_STAKE || lockoutActive) return undefined;

    const requestId = estimateRequestRef.current + 1;
    estimateRequestRef.current = requestId;
    let active = true;

    setEstimateLoading(true);
    estimateBentoBet({
      token,
      duelId: market.duelId,
      optionIndex: autoPick.index,
      amountWei,
      slippageBps: 100,
    })
      .then((payload) => {
        if (!active || requestId !== estimateRequestRef.current) return;
        const nextEstimate = extractEstimate(payload);
        setEstimate(nextEstimate);
        setSettlement({
          tone: autoPick.index === 0 ? "yes" : "no",
          icon: autoPick.index === 0 ? "Y" : "N",
          title: `${autoPick.label} preview ready`,
          body: nextEstimate.sharesOut
            ? `${formatMoney(stake)} ${stakeCurrency} for estimated ${weiToHuman(nextEstimate.sharesOut)} shares.`
            : `${formatMoney(stake)} ${stakeCurrency} ticket preview is ready.`,
          payout: "Preview",
          receipt: null,
        });
      })
      .catch((error) => {
        if (!active || requestId !== estimateRequestRef.current) return;
        setSettlement({
          tone: autoPick.index === 0 ? "yes" : "no",
          icon: autoPick.index === 0 ? "Y" : "N",
          title: `${autoPick.label} quote unavailable`,
          body: error.message || "Bento could not preview this random ticket.",
          payout: "Retry",
          receipt: null,
        });
      })
      .finally(() => {
        if (active && requestId === estimateRequestRef.current) setEstimateLoading(false);
      });

    return () => {
      active = false;
    };
  }, [amountWei, authed, autoPick, lockoutActive, market, marketEnded, stake, stakeCurrency, token]);

  useEffect(() => {
    if (!market?.duelId) {
      setMarketAnalytics(null);
      setMarketAnalyticsError("");
      return undefined;
    }

    let active = true;
    setMarketAnalyticsError("");
    fetchBentoMarketAnalytics(market.duelId)
      .then((payload) => {
        if (active) setMarketAnalytics(payload.analytics || null);
      })
      .catch((error) => {
        if (!active) return;
        setMarketAnalytics(null);
        setMarketAnalyticsError(error.message);
      });

    return () => {
      active = false;
    };
  }, [market?.duelId]);

  useEffect(() => {
    if (!token || !market?.duelId) {
      setUserShares(null);
      return undefined;
    }

    let active = true;
    fetchBentoUserShares({ token, duelId: market.duelId })
      .then((payload) => {
        if (active) setUserShares(payload.shares || null);
      })
      .catch(() => {
        if (active) setUserShares(null);
      });
    return () => {
      active = false;
    };
  }, [market?.duelId, token]);

  useEffect(() => {
    let alive = true;
    fetchLeaderboardUsers()
      .then((users) => {
        if (alive && users.length) setProfiles(users.map(normalizeProfile));
      })
      .catch(() => {
        if (alive) showToast("Using local leaderboard cache");
      })
      .finally(() => {
        if (alive) setProfilesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchPrivateGroups()
      .then((groups) => {
        if (alive && groups.length) setPrivateGroups(groups.map(normalizePrivateGroup));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const invite = url.searchParams.get("invite");
    const create = url.searchParams.get("create");
    if (create === "market") {
      setMarketCreatorOpen(true);
      setExplorerOpen(false);
      url.searchParams.delete("create");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    if (!invite) return;
    setGroupDraft((draft) => ({ ...draft, code: invite.toUpperCase() }));
    setGroupMode("join");
    setGroupModalOpen(true);
    setExplorerOpen(false);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    let alive = true;
    discoverEvmWalletOptions()
      .then((options) => {
        if (alive) setWalletOptions(options);
      })
      .finally(() => {
        if (alive) setWalletOptionsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchBentoReadiness().then((next) => {
      if (alive) setReadiness(next || initialBentoReadiness);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!readiness.configured) {
      setMarkets([]);
      setMarketError("");
      setMarketsLoading(false);
      return () => {
        alive = false;
      };
    }

    setMarketsLoading(true);
    fetchBentoMarkets({ page: 1, limit: 20 })
      .then((nextMarkets) => {
        if (!alive) return;
        setMarkets(nextMarkets.filter((item) => item.duelId));
        setMarketError("");
      })
      .catch((error) => {
        if (!alive) return;
        setMarketError(error.message);
        setMarkets([]);
      })
      .finally(() => {
        if (alive) setMarketsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [readiness.configured]);

  useEffect(() => {
    if (!markets.length) return;
    setMarketIndex((currentIndex) => Math.min(currentIndex, markets.length - 1));
  }, [markets]);

  useEffect(() => {
    if (!markets.length) return;

    const url = new URL(window.location.href);
    const queryMarket = url.searchParams.get("market");
    const querySide = url.searchParams.get("side");
    if (!queryMarket) return;

    setMarketIndex(marketIndexFromDuelId(markets, queryMarket));
    if (querySide === "yes") setPick(0);
    if (querySide === "no") setPick(1);

    url.searchParams.delete("market");
    url.searchParams.delete("side");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [markets]);

  useEffect(() => {
    if (market && !marketEnded) return;

    setPick(null);
    setEstimate(null);
    setSettlement(marketEnded
        ? {
          tone: "idle",
          icon: <Lock size={18} />,
          title: "Match final",
          body: finalResult.detail,
          payout: "Final",
          receipt: null,
        }
      : {
          tone: "idle",
          icon: "?",
          title: market ? "Ready for your pick" : "Choose a match market",
          body: market ? "Select an outcome to preview the ticket." : "Live match markets will appear here when the board loads.",
          payout: "--",
          receipt: null,
        });
  }, [market?.duelId, market?.endTime, market?.status, marketEnded]);

  useEffect(() => {
    if (!token) return;
    refreshPortfolio();
    return () => window.clearTimeout(reconcileTimer.current);
  }, [token]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (!code) return;

    setLinkLoading(true);
    exchangeBentoWalletCode({ code })
      .then((payload) => {
        const login = normalizeExternalLogin(payload);
        if (!login.token) throw new Error("Wallet link did not return a session");
        setAuthMode("link");
        setWallet(login.address || "");
        setManagedAccount(login.managedAccount || "");
        setFeed((items) => [{ minute: timeStamp(), label: "Wallet linked. Browser wallet still required for tickets." }, ...items].slice(0, 6));
        showToast("Wallet linked for profile");
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      })
      .catch((error) => showToast(error.message))
      .finally(() => setLinkLoading(false));
  }, []);

  const connectWallet = async (walletOption) => {
    const ethereum = walletOption?.provider || window.ethereum;
    if (!ethereum?.request) {
      showToast("No browser wallet found. Use wallet link.");
      return;
    }

    setWalletLoading(true);
    try {
      const [address] = await ethereum.request({ method: "eth_requestAccounts" });
      const timestamp = String(Date.now());
      const message = `Bento.fun Login\nTimestamp: ${timestamp}\nWallet: ${address}`;
      const signature = await ethereum.request({
        method: "personal_sign",
        params: [message, address],
      });
      const login = normalizeBentoLogin(
        await loginBentoWallet({
          address,
          signature,
          timestamp,
          username: activeProfile?.username || activeProfile?.name || `haramball-${address.slice(2, 8)}`,
        }),
      );

      if (!login.token) throw new Error("Market login did not return a session");
      setWallet(address);
      setToken(login.token);
      setAuthMode("wallet");
      setManagedAccount(login.managedAccount || "");
      setProfiles((items) => attachWalletToProfiles(items, activeProfileId, address, login.managedAccount));
      setFeed((items) => [{ minute: timeStamp(), label: `${walletOption?.name || "Wallet"} connected for matchday markets` }, ...items].slice(0, 6));
      showToast(`${walletOption?.name || "Wallet"} connected`);
    } catch (error) {
      showToast(walletErrorMessage(error));
    } finally {
      setWalletLoading(false);
    }
  };

  const connectWithWalletLink = async () => {
    setLinkLoading(true);
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}`;
      const state = activeProfile?.id || `haramball-${Date.now()}`;
      const payload = await createBentoWalletLink({ returnUrl, state });
      const url = payload.url || payload.data?.url;
      if (!url) throw new Error("Wallet link did not return a URL");
      window.location.href = url;
    } catch (error) {
      showToast(error.message);
    } finally {
      setLinkLoading(false);
    }
  };

  const quotePick = async (optionIndex) => {
    if (!market) return;
    if (marketEnded) {
      showToast("Tournament has ended");
      return;
    }
    if (lockoutActive) {
      showToast("Market is locked for the final 15%");
      return;
    }
    setPick(optionIndex);
    setEstimate(null);

    if (!authed) {
      openProfileModal(activeProfile ? "settings" : "onboarding");
      showToast(authMode === "link" ? "Use browser wallet to trade" : "Connect wallet before previewing");
      return;
    }
    if (Number(stake) < MIN_BENTO_STAKE) {
      showToast(`Enter at least ${MIN_BENTO_STAKE} ${stakeCurrency}`);
      return;
    }

    setEstimateLoading(true);
    try {
      const nextEstimate = extractEstimate(
        await estimateBentoBet({
          token,
          duelId: market.duelId,
          optionIndex,
          amountWei,
          slippageBps: 100,
        }),
      );
      setEstimate(nextEstimate);
      setSettlement({
        tone: optionIndex === 0 ? "yes" : "no",
        icon: optionIndex === 0 ? "Y" : "N",
        title: `${optionIndex === 0 ? market.optionA : market.optionB} preview ready`,
        body: nextEstimate.sharesOut
          ? `${formatMoney(stake)} ${stakeCurrency} for estimated ${weiToHuman(nextEstimate.sharesOut)} shares.`
          : `${formatMoney(stake)} ${stakeCurrency} ticket preview is ready.`,
        payout: "Preview",
        receipt: null,
      });
    } catch (error) {
      showToast(error.message);
    } finally {
      setEstimateLoading(false);
    }
  };

  const submitBet = async () => {
    if (marketEnded) {
      showToast("Tournament has ended");
      return;
    }
    if (!market || pick === null || !estimate) {
      showToast("Preview an outcome first");
      return;
    }
    if (lockoutActive) {
      showToast("Market is locked for the final 15%");
      return;
    }

    setPlacing(true);
    const idempotencyKey = crypto.randomUUID();
    const quote = estimate.raw?.estimate || estimate.raw?.data?.estimate || estimate.raw?.data || estimate.raw;
    const bet = {
      estimate: quote,
      duelId: market.duelId,
      duelType: "prediction",
      bet: optionLabel,
      optionIndex: pick,
      betAmount: amountWei,
      betAmountUsdc: amountWei,
      slippageBps: 100,
      tokenDecimals,
      collateralMode: market.raw?.collateralMode || market.raw?.collateral_mode || undefined,
    };

    try {
      await placeBentoBet({ token, idempotencyKey, bet });
      const receipt = {
        duelId: market.duelId,
        market: market.title,
        outcome: optionLabel,
        stake: `${formatMoney(stake)} ${stakeCurrency}`,
        shares: estimate.sharesOut ? weiToHuman(estimate.sharesOut) : "pending",
        quoteId: estimate.quoteId || "sdk",
        idempotencyKey,
        account: managedAccount || "Market account",
      };
      setSettlement({
        tone: "won",
        icon: <ShieldCheck size={18} />,
        title: "Ticket locked",
        body: "Your position is live. We are refreshing your account until the market catches up.",
        payout: "Pending",
        receipt,
      });
      setFeed((items) => [{ minute: timeStamp(), label: `${optionLabel} ticket locked for ${fixture.label}` }, ...items].slice(0, 6));
      showToast("Ticket locked");
      reconcilePortfolio(0);
    } catch (error) {
      showToast(error.message);
    } finally {
      setPlacing(false);
    }
  };

  const refreshPortfolio = async () => {
    setPortfolioLoading(true);
    try {
      const nextPortfolio = await fetchBentoPortfolio({ token, account: managedAccount });
      setPortfolio(nextPortfolio);
      return nextPortfolio;
    } catch (error) {
      setSettlement((value) => ({
        ...value,
        title: value.receipt ? "Ticket locked, account refresh delayed" : value.title,
        body: value.receipt
          ? `Bento accepted the ticket, but portfolio reconciliation failed: ${error.message}`
          : value.body,
      }));
      showToast("Portfolio refresh failed");
      return null;
    } finally {
      setPortfolioLoading(false);
    }
  };

  const reconcilePortfolio = (attempt) => {
    window.clearTimeout(reconcileTimer.current);
    reconcileTimer.current = window.setTimeout(async () => {
      const nextPortfolio = await refreshPortfolio();
      if (nextPortfolio) {
        setSettlement((value) => ({
          ...value,
          title: attempt > 0 ? "Account refreshed" : value.title,
          body: "Your account has refreshed. Final result updates when the market settles.",
        }));
      }
      if (attempt < 4) reconcilePortfolio(attempt + 1);
    }, attempt === 0 ? 1200 : 3500);
  };

  const openProfileModal = (mode) => {
    setProfileMode(mode);
    if (activeProfile) {
      setProfileDraft({
        name: activeProfile.name,
        username: activeProfile.username || "",
        team: activeProfile.team,
        style: activeProfile.style,
        twitter: activeProfile.twitter || "",
        discord: activeProfile.discord || "",
      });
    }
    setProfileModalOpen(true);
    setProfileMenuOpen(false);
  };

  const saveProfile = (event) => {
    event.preventDefault();
    const cleanName = profileDraft.name.trim();
    const cleanUsername = usernameFrom(profileDraft.username || cleanName);
    if (!cleanName) {
      showToast("Add a profile name");
      return;
    }

    const existing = profileMode !== "onboarding" && activeProfile;
    const nextProfile = normalizeProfile(existing
      ? { ...activeProfile, name: cleanName, username: cleanUsername, team: profileDraft.team, style: profileDraft.style, twitter: profileDraft.twitter, discord: profileDraft.discord, walletId: wallet || activeProfile.walletId, managedAccount: managedAccount || activeProfile.managedAccount }
      : {
          id: profileIdFrom({ username: cleanUsername, walletId: wallet, name: cleanName }),
          name: cleanName,
          username: cleanUsername,
          team: profileDraft.team,
          style: profileDraft.style,
          twitter: profileDraft.twitter,
          discord: profileDraft.discord,
          walletId: wallet,
  managedAccount,
          wins: 0,
          losses: 0,
        });

    setProfiles((items) => dedupeProfiles(existing ? items.map((item) => item.id === activeProfile.id ? nextProfile : item) : [...items, nextProfile]));
    saveLeaderboardUser(nextProfile)
      .then((saved) => setProfiles((items) => dedupeProfiles(items.map((item) => item.id === saved.id ? normalizeProfile(saved) : item))))
      .catch(() => showToast("Profile saved locally only"));
    setActiveProfileId(nextProfile.id);
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, nextProfile.id);
    setProfileDraft({ name: "", username: "", team: profileDraft.team, style: profileDraft.style, twitter: "", discord: "" });
    setProfileModalOpen(false);
    setFeed((items) => [{ minute: timeStamp(), label: existing ? `${cleanName} updated their fan profile` : `${cleanName} joined the leaderboard` }, ...items].slice(0, 6));
    showToast(existing ? "Profile updated" : "Profile created");
  };

  const openGroupModal = (mode = activeGroup ? "invite" : "create") => {
    setGroupMode(mode);
    setGroupDraft((draft) => ({
      ...draft,
      name: activeGroup?.name || draft.name || "",
      code: mode === "join" ? draft.code : activeGroup?.code || draft.code || "",
    }));
    setGroupModalOpen(true);
  };

  const createGroup = async (event) => {
    event.preventDefault();
    const name = groupDraft.name.trim();
    if (!name) {
      showToast("Name your private group");
      return;
    }
    try {
      const group = normalizePrivateGroup(await createPrivateGroup({ name, owner: activeProfile || { username: "host", name: "Host" } }));
      setPrivateGroups((groups) => [group, ...groups.filter((item) => item.id !== group.id)]);
      setActiveGroupId(group.id);
      setGroupMode("invite");
      setGroupDraft((draft) => ({ ...draft, name: group.name, code: group.code }));
      showToast("Private group created");
    } catch {
      const group = normalizePrivateGroup({
        id: `local-group-${Date.now()}`,
        name,
        code: Math.random().toString(36).slice(2, 8).toUpperCase(),
        owner: activeProfile || { username: "host", name: "Host" },
        members: [activeProfile || { username: "host", name: "Host" }],
        invites: [],
      });
      setPrivateGroups((groups) => [group, ...groups]);
      setActiveGroupId(group.id);
      setGroupMode("invite");
      setGroupDraft((draft) => ({ ...draft, name: group.name, code: group.code }));
      showToast("Group saved locally");
    }
  };

  const inviteToGroup = async (event) => {
    event.preventDefault();
    const target = groupDraft.invite.trim();
    if (!activeGroup || !target) {
      showToast(activeGroup ? "Add a username or email" : "Create a group first");
      return;
    }
    try {
      const group = normalizePrivateGroup(await invitePrivateGroup({ groupId: activeGroup.id, code: activeGroup.code, target }));
      setPrivateGroups((groups) => groups.map((item) => item.id === group.id ? group : item));
      setGroupDraft((draft) => ({ ...draft, invite: "" }));
      showToast("Invite added");
    } catch {
      const group = normalizePrivateGroup({
        ...activeGroup,
        invites: [...activeGroup.invites, { target, type: target.includes("@") ? "email" : "username" }],
      });
      setPrivateGroups((groups) => groups.map((item) => item.id === activeGroup.id ? group : item));
      setGroupDraft((draft) => ({ ...draft, invite: "" }));
      showToast("Invite saved locally");
    }
  };

  const joinGroup = async (event) => {
    event.preventDefault();
    const code = groupDraft.code.trim().toUpperCase();
    if (!code) {
      showToast("Enter an invite code");
      return;
    }
    try {
      const group = normalizePrivateGroup(await joinPrivateGroup({ code, member: activeProfile || { username: profileDraft.username, name: profileDraft.name } }));
      setPrivateGroups((groups) => [group, ...groups.filter((item) => item.id !== group.id)]);
      setActiveGroupId(group.id);
      setGroupModalOpen(false);
      showToast(`Joined ${group.name}`);
    } catch {
      showToast("Invite code not found");
    }
  };

  const copyInviteLink = async () => {
    if (!activeGroup) return;
    const link = inviteLink(activeGroup.code);
    try {
      await navigator.clipboard.writeText(link);
      showToast("Invite link copied");
    } catch {
      showToast(link);
    }
  };

  const openMarketCreator = () => {
    setMarketDraft(defaultMarketDraft());
    setMarketCreatorOpen(true);
  };

  const submitMarketDraft = async (event) => {
    event.preventDefault();
    if (!token) {
      showToast("Connect wallet before creating on Bento");
      setMarketCreatorOpen(false);
      openProfileModal(activeProfile ? "settings" : "onboarding");
      return;
    }
    if (!marketDraft.question.trim() || !marketDraft.category || !marketDraft.description.trim()) {
      showToast("Add name, category, and rules");
      return;
    }

    setMarketCreating(true);
    try {
      const creation = await createBentoMarketDraft({
        token,
        requestId: `haramball-market-${Date.now()}`,
        market: {
          ...marketDraft,
          startTime: localInputToIso(marketDraft.startTime),
          endTime: localInputToIso(marketDraft.endTime),
          tags: marketDraft.tags,
        },
      });
      setMarketCreatorOpen(false);
      setFeed((items) => [{ minute: timeStamp(), label: `Created Bento market: ${marketDraft.question}` }, ...items].slice(0, 6));
      showToast(creation?.raw?.duelId || creation?.duelId ? "Bento market submitted" : "Market creation submitted");
      fetchBentoMarkets({ page: 1, limit: 20 })
        .then((nextMarkets) => setMarkets(nextMarkets.filter((item) => item.duelId)))
        .catch(() => {});
    } catch (error) {
      showToast(error.message || "Bento could not create market");
    } finally {
      setMarketCreating(false);
    }
  };

  const openTokenModal = () => {
    setTokenSearch("");
    setTokenModalOpen(true);
  };

  const confirmToken = () => {
    setStakeCurrency("USDC");
    setTokenModalOpen(false);
    showToast("Bets launch in USDC only");
  };

  const statusCards = [
    {
      icon: <Clock3 size={18} />,
      label: "Match Board",
      value: marketEnded ? "Explore" : marketsLoading ? "Loading" : `${markets.length} markets`,
      body: marketEnded
        ? "Use Explore to jump into active tournaments and upcoming race weekends."
        : "Match markets load before you connect a wallet.",
    },
    {
      icon: <Gauge size={18} />,
      label: "Ticket",
      value: marketEnded ? "Tournaments" : estimate ? "Ready" : "Required",
      body: marketEnded
        ? "Enter verified Bento competitions from the calendar without leaving home."
        : "Preview shares and price before locking a pick.",
    },
    {
      icon: <ShieldCheck size={18} />,
      label: "Result",
      value: marketEnded ? "History" : "Tracked",
      body: marketEnded
        ? "Final markets stay readable while the product keeps the next actions up front."
        : "Your account refreshes after every locked ticket.",
    },
  ];

  if (profileRouteUsername) {
    return (
      <main className="app-shell profile-route-shell">
        <section className="phone-frame" aria-label={`haramball.xyz profile ${profileRouteUsername}`}>
          <div className="phone-screen">
            <header className="profile-route-hero">
              <a className="back-link" href="/">haramball.xyz</a>
              <a className="back-arrow-button" href="/" aria-label="Back to markets">
                <ArrowLeft size={20} />
              </a>
              <h1>@{profileRouteUsername}</h1>
              <p>Profile, interactions, and market activity.</p>
            </header>
            <section className="play-stack">
              <ProfileActivityCard activeProfile={routeProfile} fallbackToFirst={false} feed={feed} loading={profilesLoading} profiles={leaderboard} />
              <LeaderboardCard loading={profilesLoading} profiles={leaderboard} />
            </section>
        </div>
      </section>
      <aside className="desktop-panel">
          <ProfileActivityCard activeProfile={routeProfile} fallbackToFirst={false} feed={feed} loading={profilesLoading} profiles={leaderboard} wide />
        </aside>
        <div className={toast ? "toast show" : "toast"}>{toast}</div>
      </main>
    );
  }

  return (
    <main className={`app-shell ${marketEnded ? "is-ended-market" : ""}`}>
      <section className="phone-frame" aria-label="haramball.xyz markets app">
        <div className="phone-screen">
          <header className={`match-hero ${marketEnded ? "is-ended" : ""}`}>
            <nav className="topbar" aria-label="Match controls">
              <div className="brand">
                <span className="brand-wordmark">haramball.xyz</span>
              </div>
              <div className="topbar-actions">
                <button
                  className="create-market-nav-button"
                  onClick={openMarketCreator}
                  type="button"
                >
                  <Plus size={17} />
                  <span>Create</span>
                </button>
                <button
                  className="explorer-nav-button"
                  onClick={() => setExplorerOpen(true)}
                  ref={explorerButtonRef}
                  type="button"
                >
                  <Compass size={17} />
                  <span>Explore</span>
                </button>
                {marketEnded ? (
                  <span className="ended-badge"><Lock size={14} /> Ended</span>
                ) : (
                <>
                <div className="notification-menu-wrap">
                  <button className="notification-button" onClick={() => setNotificationsOpen((value) => !value)} type="button" aria-label="Notifications">
                    <Bell size={18} />
                    {unreadCount ? <span>{unreadCount}</span> : null}
                  </button>
                  {notificationsOpen ? (
                    <div className="notification-dropdown">
                      <div className="notification-head">
                        <strong>Notifications</strong>
                        <button onClick={markNotificationsRead} type="button">Mark read</button>
                      </div>
                      {notifications.length ? notifications.map((item) => (
                        <div className={readNotificationIds.includes(item.id) ? "notification-row read" : "notification-row"} key={item.id}>
                          <strong>{item.minute}</strong>
                          <span>{item.label}</span>
                        </div>
                      )) : (
                        <div className="notification-empty">No notifications yet</div>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="profile-menu-wrap">
                <button className="profile-icon-button" onClick={() => activeProfile ? setProfileMenuOpen((value) => !value) : openProfileModal("onboarding")} type="button">
                  {activeProfile ? teamFlag(activeProfile.team) : <UserCircle size={20} />}
                </button>
                {profileMenuOpen ? (
                  <div className="profile-dropdown">
                    <div className="profile-dropdown-head">
                      <strong>{activeProfile.name}</strong>
                      <span>{activeProfile.team} - {activeProfile.style}</span>
                    </div>
                    <button onClick={() => openProfileModal("edit")} type="button">
                      <UserCircle size={15} />
                      Profile
                    </button>
                    <button onClick={() => openProfileModal("settings")} type="button">
                      <Settings size={15} />
                      Settings
                    </button>
                    <a href="/portfolio">
                      <Wallet size={15} />
                      Portfolio
                    </a>
                    <a href="/leaderboard">
                      <Trophy size={15} />
                      Leaderboard
                    </a>
                    <a href="/live">
                      <Flame size={15} />
                      Live Centre
                    </a>
                    <a href="/tournaments">
                      <Medal size={15} />
                      Tournaments
                    </a>
                    <button onClick={() => setTheme((value) => value === "classic" ? "night" : "classic")} type="button">
                      <Palette size={15} />
                      Theme: {theme === "classic" ? "Classic" : "Night"}
                    </button>
                  </div>
                ) : null}
                </div>
                </>
              )}
              </div>
            </nav>

            <div className="scoreline">
              {market ? (
                <>
                  <Team name={fixture.home} />
                  <div className="score">vs</div>
                  <Team name={fixture.away} align="right" />
                </>
              ) : (
                <div className="hero-empty-state">{marketBoardLoading ? "Opening Explorer" : "No live market data"}</div>
              )}
            </div>
            {market ? (
              <div className={`market-context ${marketEnded ? "is-ended" : ""}`} aria-label="Market context">
                <div className="fixture-picker">
                  <span>{marketEnded ? "Final match" : "Random bet"}</span>
                  <b title={market.title || market.duelId}>
                    {marketEnded ? finalResult.match || fixture.label : market.title && market.title !== fixture.label ? market.title : fixture.label}
                  </b>
                </div>
                <a href={`/markets/${encodeURIComponent(market.duelId)}`}>{[leagueName, marketEnded ? "Ended" : "Market page"].filter(Boolean).join(" - ")}</a>
              </div>
            ) : null}

          </header>

          <section className="play-stack">
            {marketError ? <p className="state-note">{marketError}</p> : null}

            <article className={`cycle-card ${marketEnded ? "is-ended" : "is-action"}`}>
              <div className="timer-block">
                <div className="timer-label">
                  <span>{marketEnded ? "Product ready" : lockoutActive ? "Market locked" : "Lock closes in"}</span>
                  <b>{marketEnded ? "Explore" : `${secondsRemaining}s`}</b>
                </div>
                <div className="progress-track">
                  <span className={marketEnded || lockoutActive ? "is-locked" : ""} style={{ width: marketEnded ? "100%" : `${progressPercent}%` }} />
                </div>
              </div>

              <div className="question-block">
                <h1>{displayedMarketTitle}</h1>
                <p>{displayedMarketBody}</p>
              </div>

              {!marketEnded ? (
                <>
              <div className="stake-block">
                <div className="stake-label">
                  <span>Stake</span>
                  <strong>{formatMoney(stake)} {stakeCurrency}</strong>
                </div>
                <label className="stake-input-wrap">
                  <Coins size={16} />
                  <input
                    disabled={!market || placing}
                    inputMode="decimal"
                    min="0.01"
                    onChange={(event) => setStake(event.target.value)}
                    placeholder="Type any amount"
                    step="0.01"
                    type="number"
                    value={stake}
                  />
                  <button className="token-select-button" disabled={!market || placing} onClick={openTokenModal} type="button">
                    <span>{selectedToken.symbol}</span>
                    <ChevronDown size={14} />
                  </button>
                </label>
                <div className="chip-grid">
                  {["1", "2.5", "5", "10"].map((amount) => (
                    <button
                      className={stake === amount ? "chip active" : "chip"}
                      disabled={!market || placing}
                      key={amount}
                      onClick={() => setStake(amount)}
                      type="button"
                    >
                      <Coins size={15} />
                      {amount}
                    </button>
                  ))}
                </div>
              </div>

              <div className="auto-pick-banner" role="status" aria-live="polite">
                <span>Auto bet</span>
                <strong>{autoPick ? autoPick.label : "Waiting for next random pick"}</strong>
                <small>{marketEnded ? "Tournament ended" : "One random side is locked every 15 seconds"}</small>
              </div>

              <div className="market-nav">
                <button className="activate-button" disabled={!estimate || placing || lockoutActive} onClick={submitBet} type="button">
                  <Lock size={17} />
                  {placing ? <SkeletonLine width="104px" /> : "Lock Random Ticket"}
                </button>
              </div>
                </>
              ) : (
                <div className="ended-market-notice product-mode-notice" role="status">
                  <Compass size={20} />
                  <div>
                    <small>Next actions</small>
                    <strong>Calendar, markets, and groups are ready.</strong>
                    <span>Completed markets stay readable, while the product tools stay one tap away.</span>
                  </div>
                </div>
              )}
            </article>

            {!marketEnded ? (
              <>
            <SettlementCard
              estimate={estimate}
              estimateLoading={estimateLoading}
              market={market}
              pick={pick}
              placing={placing}
              settlement={settlement}
              stake={stake}
              stakeCurrency={stakeCurrency}
            />
            <MarketIntelCard analytics={marketAnalytics} error={marketAnalyticsError} shares={userShares} />
            <FeedCard feed={feed} loading={portfolioLoading} portfolio={portfolio} />
            <LeaderboardCard loading={profilesLoading} profiles={leaderboard} />
            <PrivateGroupCard group={activeGroup} onOpen={openGroupModal} />
              </>
            ) : (
              <ProductModeStack
                activeGroup={activeGroup}
                activeProfile={activeProfile}
                feed={feed}
                loading={profilesLoading}
                onCreateMarket={openMarketCreator}
                onExplore={() => setExplorerOpen(true)}
                onOpenGroup={openGroupModal}
                profiles={leaderboard}
                statusCards={statusCards}
              />
            )}
          </section>
        </div>
      </section>

      <aside className="desktop-panel">
        <section className="intro-panel">
          <div className="eyebrow">
            <Flame size={16} />
            {marketEnded ? "Product mode" : "Match market rush"}
          </div>
          <h2>{marketEnded ? "Find the next tournament to play." : "Pick the moment before the stadium does."}</h2>
          <p>
            {marketEnded
              ? "haramball.xyz keeps completed markets out of the way and opens the verified Bento calendar for live tournaments, clean entry, and account refreshes."
              : "haramball.xyz is a fast market board for quick YES/NO calls, clean tickets, and live account refreshes."}
          </p>
        </section>

        <section className="status-grid">
          {statusCards.map((card) => (
            <article className="status-card" key={card.label}>
              <span className="status-icon">{card.icon}</span>
              <small>{card.label}</small>
              <strong>{card.value}</strong>
              <p>{card.body}</p>
            </article>
          ))}
        </section>

        <section className="architecture-panel">
          <h2>Matchday Flow</h2>
          <div className="rail-item">
            <BadgeDollarSign size={18} />
            <span>Live market board loads before wallet connection</span>
          </div>
          <div className="rail-item">
            <Zap size={18} />
            <span>One wallet signature opens the market account</span>
          </div>
          <div className="rail-item">
            <Trophy size={18} />
            <span>Preview, lock, and track every ticket clearly</span>
          </div>
        </section>

        <button className="create-market-panel-button" onClick={openMarketCreator} type="button">
          <Plus size={18} />
          Create New Market
        </button>
        <PrivateGroupCard group={activeGroup} onOpen={openGroupModal} wide />
        <ProfileActivityCard activeProfile={activeProfile} feed={feed} loading={profilesLoading} profiles={leaderboard} wide />
      </aside>

      {profileModalOpen && !marketEnded ? (
        <OnboardingModal
          activeProfile={activeProfile}
          authMode={authMode}
          connectWallet={connectWallet}
          connectWithWalletLink={connectWithWalletLink}
          draft={profileDraft}
          linkLoading={linkLoading}
          mode={profileMode}
          setDraft={setProfileDraft}
          onClose={() => activeProfile && setProfileModalOpen(false)}
          onSubmit={saveProfile}
          wallet={wallet}
          walletLoading={walletLoading}
          walletOptions={walletOptions}
          walletOptionsLoading={walletOptionsLoading}
        />
      ) : null}

      {tokenModalOpen && !marketEnded ? (
        <TokenModal
          onCancel={() => setTokenModalOpen(false)}
          onConfirm={confirmToken}
          search={tokenSearch}
          setSearch={setTokenSearch}
          selected={stakeCurrency}
        />
      ) : null}

      <ExplorerModal
        onClose={closeExplorer}
        onEnterTournament={enterTournamentFromExplorer}
        onSelectTournament={() => {}}
        open={explorerOpen}
      />
      <TournamentDialog
        onClose={() => setActiveTournamentSlug("")}
        open={Boolean(activeTournamentSlug)}
        slug={activeTournamentSlug}
      />
      {groupModalOpen ? (
        <PrivateGroupModal
          activeGroup={activeGroup}
          draft={groupDraft}
          inviteLink={activeGroup ? inviteLink(activeGroup.code) : ""}
          mode={groupMode}
          onClose={() => setGroupModalOpen(false)}
          onCopyLink={copyInviteLink}
          onCreate={createGroup}
          onInvite={inviteToGroup}
          onJoin={joinGroup}
          setDraft={setGroupDraft}
          setMode={setGroupMode}
        />
      ) : null}
      {marketCreatorOpen ? (
        <MarketCreatorModal
          creating={marketCreating}
          draft={marketDraft}
          onClose={() => !marketCreating && setMarketCreatorOpen(false)}
          onSubmit={submitMarketDraft}
          setDraft={setMarketDraft}
        />
      ) : null}

      <div className={toast ? "toast show" : "toast"}>{toast}</div>
    </main>
  );
}

function App() {
  const tournamentSlug = tournamentSlugFromPath(window.location.pathname);
  const marketId = marketIdFromPath(window.location.pathname);
  if (window.location.pathname === "/portfolio") return <PortfolioPage />;
  if (window.location.pathname === "/leaderboard") return <LeaderboardPage />;
  if (window.location.pathname === "/live" || window.location.pathname === "/feeds") return <LiveCentrePage />;
  if (window.location.pathname === "/tournaments") return <TournamentManagerPage />;
  if (marketId) return <MarketDetailPage duelId={marketId} />;
  return tournamentSlug ? <TournamentPage slug={tournamentSlug} /> : <MarketApp />;
}

function MarketDetailPage({ duelId }) {
  const [market, setMarket] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("all");
  const [selectedSide, setSelectedSide] = useState("yes");
  const [setupMode, setSetupMode] = useState("create");
  const metrics = marketDetailMetrics(market, analytics || {});
  const history = marketPriceHistory(analytics || {}, market || {});
  const outcomes = marketOutcomeRows(market || {}, analytics || {});
  const depthYes = marketDepthRows(market || {}, analytics || {}, "yes");
  const depthNo = marketDepthRows(market || {}, analytics || {}, "no");
  const primary = outcomes[0] || { label: "Yes", price: 0 };
  const secondary = outcomes[1] || { label: "No", price: 0 };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      fetchBentoMarket(duelId),
      fetchBentoMarketAnalytics(duelId).catch((loadError) => ({ analytics: { error: loadError.message } })),
    ])
      .then(([nextMarket, nextAnalytics]) => {
        if (!alive) return;
        setMarket(nextMarket);
        setAnalytics(nextAnalytics.analytics || nextAnalytics);
      })
      .catch((loadError) => {
        if (alive) setError(loadError.message || "Market failed to load");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [duelId]);

  return (
    <main className="market-detail-shell">
      <header className="market-detail-header">
        <a className="back-link" href="/"><ArrowLeft size={16} /> Markets</a>
        <div className="market-title-row">
          <span className="market-detail-avatar">{(market?.optionA || market?.title || "M").slice(0, 1)}</span>
          <div>
            <h1>{market?.title || (loading ? "Loading market..." : "Market unavailable")}</h1>
            <small>{market?.category || market?.status || duelId}</small>
          </div>
        </div>
      </header>

      {error ? <div className="market-detail-error">{error}</div> : null}
      <div className="market-detail-layout">
        <section className="market-detail-main">
          <div className="market-metric-strip">
            <MarketMetric label="Volume" value={`$${formatCompact(metrics.volume)}`} />
            <MarketMetric label="Liquidity" value={`$${formatCompact(metrics.liquidity)}`} />
            <MarketMetric label="24h Vol" value={`$${formatCompact(metrics.volume24h)}`} />
          </div>

          <div className="market-chart-head">
            <h2>Price History</h2>
            <div className="market-range-tabs">
              {["1h", "6h", "1d", "1w", "1m", "all"].map((item) => (
                <button className={range === item ? "active" : ""} key={item} onClick={() => setRange(item)} type="button">
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <MarketHistoryChart history={history} loading={loading} />
          <div className="market-outcome-tabs">
            {outcomes.map((row) => (
              <button className={selectedSide === row.tone ? "active" : ""} key={row.id} onClick={() => setSelectedSide(row.tone)} type="button">
                <span className={`outcome-dot ${row.tone}`} />
                {row.label}
                <b>{row.price.toFixed(1)}%</b>
              </button>
            ))}
          </div>

          <section className="market-outcome-list">
            {loading ? <LiveCentreSkeleton /> : outcomes.length ? outcomes.map((row) => (
              <article className="market-outcome-row" key={row.id}>
                <span className="market-detail-avatar">{row.label.slice(0, 1)}</span>
                <div>
                  <strong>{row.label}</strong>
                  <small>${formatCompact(row.volume)} vol</small>
                </div>
                <a className="market-buy yes" href={`/?market=${encodeURIComponent(duelId)}&side=yes`}>Yes {row.price.toFixed(1)}c</a>
                <a className="market-buy no" href={`/?market=${encodeURIComponent(duelId)}&side=no`}>No {Math.max(0, 100 - row.price).toFixed(1)}c</a>
              </article>
            )) : <div className="live-empty-state">No outcome data returned for this market.</div>}
          </section>
        </section>

        <aside className="market-detail-rail">
          <section className="market-wallet-card">
            <span className="market-selected-chip">{selectedSide === "no" ? secondary.label : primary.label}</span>
            <div className="market-wallet-icon"><Wallet size={26} /></div>
            <h2>Setting up Polymarket</h2>
            <p>Create a trading account or import an existing wallet before trading this market.</p>
            <button className={setupMode === "create" ? "active" : ""} onClick={() => setSetupMode("create")} type="button">
              <strong>Create new account</strong>
              <span>We create a Polymarket deposit wallet linked to your Bento account.</span>
            </button>
            <button className={setupMode === "existing" ? "active" : ""} onClick={() => setSetupMode("existing")} type="button">
              <strong>Use existing Polymarket account</strong>
              <span>Import a wallet account you already use on Polymarket.</span>
            </button>
          </section>

          <section className="market-depth-card">
            <div className="market-depth-head">
              <h2>Order book</h2>
              <ChevronDown size={16} />
            </div>
            <div className="market-depth-toggle">
              <button className={selectedSide === "yes" ? "active yes" : ""} onClick={() => setSelectedSide("yes")} type="button">Yes</button>
              <button className={selectedSide === "no" ? "active no" : ""} onClick={() => setSelectedSide("no")} type="button">No</button>
            </div>
            <DepthTable rows={depthNo} tone="no" />
            <div className="market-spread-row"><span>Spread</span><b>{depthYes.length && depthNo.length ? "0.1c" : "Unavailable"}</b></div>
            <DepthTable rows={depthYes} tone="yes" />
          </section>
        </aside>
      </div>
    </main>
  );
}

function MarketMetric({ label, value }) {
  return (
    <article>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

function MarketHistoryChart({ history, loading }) {
  if (loading) return <div className="market-history-empty">Loading price history...</div>;
  if (!history.length) return <div className="market-history-empty">No Bento price snapshots yet.</div>;

  const width = 720;
  const height = 300;
  const points = (key) => history.map((row, index) => {
    const x = history.length === 1 ? width - 20 : 20 + (index / (history.length - 1)) * (width - 40);
    const y = height - 20 - (Number(row[key]) / 100) * (height - 40);
    return `${x},${y}`;
  }).join(" ");
  const latest = history.at(-1);

  return (
    <div className="market-history-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Market price history">
        <polyline points={points("yes")} fill="none" stroke="#58aaff" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        <polyline points={points("no")} fill="none" stroke="#ff4b2b" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="market-chart-label yes">{latest.yes.toFixed(0)}%</div>
      <div className="market-chart-label no">{latest.no.toFixed(0)}%</div>
    </div>
  );
}

function DepthTable({ rows, tone }) {
  if (!rows.length) return <div className="market-depth-empty">Depth unavailable</div>;
  const maxShares = Math.max(...rows.map((row) => row.shares), 1);
  return (
    <div className={`market-depth-table ${tone}`}>
      {rows.map((row) => (
        <div className="market-depth-row" key={`${tone}-${row.price}-${row.shares}`}>
          <span>{row.price.toFixed(1)}c</span>
          <i><b style={{ width: `${Math.max(12, (row.shares / maxShares) * 100)}%` }} /></i>
          <strong>{formatCompact(row.shares)}</strong>
        </div>
      ))}
    </div>
  );
}

function TournamentManagerPage() {
  const [managed, setManaged] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("All");
  const [status, setStatus] = useState("live");
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(defaultTournamentDraft);
  const [saving, setSaving] = useState(false);
  const rows = useMemo(() => managedTournamentRows(managed, catalog), [catalog, managed]);
  const sports = ["All", "Cricket", "Football", "Basketball", "NFL", "Formula 1"];
  const statusCounts = useMemo(() => ({
    live: rows.filter((row) => row.status === "live").length,
    upcoming: rows.filter((row) => row.status === "upcoming").length,
    settled: rows.filter((row) => row.status === "settled" || row.status === "ended").length,
  }), [rows]);
  const filteredRows = rows.filter((row) => {
    const haystack = `${row.name} ${row.sport} ${row.format} ${row.code} ${row.members.map((member) => member.name || member.username).join(" ")} ${row.teams.map((team) => team.name).join(" ")}`.toLowerCase();
    const sportMatch = sport === "All" || row.sport === sport || (sport === "NFL" && row.sport === "American Football");
    const statusMatch = status === "settled" ? row.status === "settled" || row.status === "ended" : row.status === status;
    return sportMatch && statusMatch && haystack.includes(query.trim().toLowerCase());
  });

  const loadTournaments = async () => {
    setLoading(true);
    try {
      const [nextManaged, nextCatalog] = await Promise.all([
        fetchManagedTournaments().catch(() => []),
        fetchExplorerItems().catch(() => []),
      ]);
      setManaged(nextManaged);
      setCatalog(nextCatalog);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  const openCreateTournament = () => {
    setDraft(defaultTournamentDraft());
    setEditorOpen(true);
  };

  const editTournament = (row) => {
    setDraft(tournamentDraftFromRow(row));
    setEditorOpen(true);
  };

  const saveTournament = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = draft.id
        ? await updateManagedTournament(tournamentPayloadFromDraft(draft))
        : await createManagedTournament(tournamentPayloadFromDraft(draft));
      setManaged((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setEditorOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const removeTournament = async (row) => {
    if (!row.editable) return;
    await deleteManagedTournament(row.id);
    setManaged((items) => items.filter((item) => item.id !== row.id));
  };

  return (
    <main className="tournament-manager-shell">
      <header className="tournament-manager-header">
        <a className="back-link" href="/"><ArrowLeft size={16} /> haramball.xyz</a>
        <h1>Tournaments</h1>
        <div className="tournament-search-row">
          <label className="tournament-search">
            <Compass size={17} />
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Search tournaments" value={query} />
          </label>
          <button className="tournament-create-button" onClick={openCreateTournament} type="button">
            <Plus size={17} />
            Create Tournament
          </button>
        </div>
      </header>

      <div className="tournament-chip-row">
        {sports.map((item) => (
          <button className={sport === item ? "active" : ""} key={item} onClick={() => setSport(item)} type="button">
            {sportIconLabel(item === "NFL" ? "American Football" : item)}
            {item}
          </button>
        ))}
      </div>

      <div className="tournament-status-tabs">
        {["live", "upcoming", "settled"].map((item) => (
          <button className={status === item ? "active" : ""} key={item} onClick={() => setStatus(item)} type="button">
            {titleCase(item)}
            <span>{statusCounts[item] || 0}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <section className="tournament-grid"><LiveCentreSkeleton /></section>
      ) : filteredRows.length ? (
        <section className="tournament-grid">
          {filteredRows.map((row) => (
            <TournamentManagerCard key={`${row.source}-${row.id}`} onDelete={removeTournament} onEdit={editTournament} row={row} />
          ))}
        </section>
      ) : (
        <div className="live-empty-state">No tournaments match this view yet.</div>
      )}

      {editorOpen ? (
        <TournamentEditorModal
          draft={draft}
          onClose={() => !saving && setEditorOpen(false)}
          onSubmit={saveTournament}
          saving={saving}
          setDraft={setDraft}
        />
      ) : null}
    </main>
  );
}

function TournamentManagerCard({ onDelete, onEdit, row }) {
  return (
    <article className="tournament-manager-card">
      <div className="tournament-cover">
        {row.coverImageUrl ? <img alt="" src={row.coverImageUrl} /> : <span>{row.code.slice(0, 2)}</span>}
      </div>
      <div className="tournament-card-main">
        <div>
          <strong>{row.name}</strong>
          <small>{row.format}</small>
        </div>
        <div className="tournament-pills">
          <span><Coins size={13} /> ${formatCompact(row.entryFee)}</span>
          <span><Trophy size={13} /> ${formatCompact(row.prizePool)}</span>
          <span><Medal size={13} /> {row.code}</span>
        </div>
        <div className="tournament-roster-line">
          <span><UserPlus size={14} /> +{row.members.length}</span>
          {row.teams.slice(0, 3).map((team) => <b key={team.id}>{team.name}</b>)}
        </div>
      </div>
      <div className="tournament-card-actions">
        <span className={`live-status-pill ${row.status === "settled" ? "ended" : row.status}`}>{row.status}</span>
        {row.editable ? (
          <>
            <button onClick={() => onEdit(row)} type="button">Edit</button>
            <button className="danger" onClick={() => onDelete(row)} type="button">Delete</button>
          </>
        ) : row.slug ? (
          <a href={`/tournaments/${encodeURIComponent(row.slug)}`}>Enter</a>
        ) : null}
      </div>
    </article>
  );
}

function TournamentEditorModal({ draft, onClose, onSubmit, saving, setDraft }) {
  const setField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="tournament-editor-modal" onSubmit={onSubmit}>
        <div className="token-modal-head">
          <div>
            <h2>{draft.id ? "Edit tournament" : "Create tournament"}</h2>
            <p>Manage players and teams for a private or public tournament room.</p>
          </div>
          <button className="profile-icon-button modal-close" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <label>
          <span>Name</span>
          <input autoFocus onChange={(event) => setField("name", event.target.value)} placeholder="FIFA World Cup: Friends League" value={draft.name} />
        </label>
        <div className="tournament-editor-grid">
          <label>
            <span>Sport</span>
            <select onChange={(event) => setField("sport", event.target.value)} value={draft.sport}>
              {["Cricket", "Football", "Basketball", "American Football", "Formula 1"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select onChange={(event) => setField("status", event.target.value)} value={draft.status}>
              {["live", "upcoming", "settled"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Entry fee</span>
            <input min="0" onChange={(event) => setField("entryFee", event.target.value)} type="number" value={draft.entryFee} />
          </label>
          <label>
            <span>Prize pool</span>
            <input min="0" onChange={(event) => setField("prizePool", event.target.value)} type="number" value={draft.prizePool} />
          </label>
        </div>
        <label>
          <span>Users</span>
          <textarea onChange={(event) => setField("membersText", event.target.value)} placeholder="dinesh, abhi@example.com, predictionnoob" value={draft.membersText} />
        </label>
        <label>
          <span>Teams</span>
          <textarea onChange={(event) => setField("teamsText", event.target.value)} placeholder="Red Bulls, Blue Lock, Final XI" value={draft.teamsText} />
        </label>
        <div className="token-modal-actions">
          <button className="chip" disabled={saving} onClick={onClose} type="button">Cancel</button>
          <button className="activate-button" disabled={saving || !draft.name.trim()} type="submit">
            {saving ? "Saving..." : draft.id ? "Save Tournament" : "Create Tournament"}
          </button>
        </div>
      </form>
    </div>
  );
}

function defaultTournamentDraft() {
  return {
    id: "",
    name: "",
    sport: "Football",
    format: "Group + Knockout",
    status: "upcoming",
    entryFee: 10,
    prizePool: 50,
    membersText: "",
    teamsText: "",
    coverImageUrl: "",
  };
}

function tournamentDraftFromRow(row) {
  return {
    ...defaultTournamentDraft(),
    ...row.raw,
    membersText: row.members.map((member) => member.email || member.username || member.name).filter(Boolean).join(", "),
    teamsText: row.teams.map((team) => team.name).join(", "),
  };
}

function tournamentPayloadFromDraft(draft) {
  return {
    id: draft.id || undefined,
    name: draft.name,
    sport: draft.sport,
    format: draft.format,
    status: draft.status,
    entryFee: Number(draft.entryFee) || 0,
    prizePool: Number(draft.prizePool) || 0,
    coverImageUrl: draft.coverImageUrl,
    members: commaItems(draft.membersText).map((value) => ({ name: value.includes("@") ? value.split("@")[0] : value, username: value, email: value.includes("@") ? value : "" })),
    teams: commaItems(draft.teamsText).map((name) => ({ name })),
  };
}

function commaItems(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function LiveCentrePage() {
  const [catalog, setCatalog] = useState([]);
  const [feeds, setFeeds] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("stats");
  const [sport, setSport] = useState("Football");
  const [league, setLeague] = useState("All Live");
  const [section, setSection] = useState("matches");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => buildLiveCentreRows(catalog, feeds), [catalog, feeds]);
  const filteredRows = useMemo(
    () => filterLiveCentreRows(rows, { league, query, section, sport }),
    [league, query, rows, section, sport],
  );
  const stats = useMemo(() => liveCentreStats(rows), [rows]);
  const standings = useMemo(() => liveCentreStandings(filteredRows), [filteredRows]);
  const newsRows = useMemo(() => liveCentreNewsRows(rows, feeds), [feeds, rows]);

  const loadLiveCentre = async ({ refresh = false } = {}) => {
    setLoading(true);
    setError("");
    try {
      const [nextCatalog, nextFeeds] = await Promise.all([
        fetchExplorerItems({ refresh }).catch((nextError) => {
          setError(nextError.message || "Bento catalog failed to load");
          return [];
        }),
        fetchBentoFeeds({ sport, league: league === "All Live" ? "" : league }).catch(() => ({})),
      ]);
      setCatalog(nextCatalog);
      setFeeds(nextFeeds);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLiveCentre();
  }, [sport, league]);

  return (
    <main className="live-centre-shell">
      <header className="live-centre-header">
        <a className="back-link" href="/"><ArrowLeft size={16} /> haramball.xyz</a>
        <h1>Live Centre</h1>
        <div className="live-centre-tabs">
          {["stats", "live", "news"].map((item) => (
            <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)} type="button">
              {titleCase(item)}
            </button>
          ))}
        </div>
      </header>

      <section className="live-centre-controls">
        <div className="live-sport-row">
          {LIVE_CENTRE_SPORTS.map((item) => (
            <button
              className={sport === item ? "active" : ""}
              disabled={item === "Tennis"}
              key={item}
              onClick={() => setSport(item)}
              type="button"
            >
              {sportIconLabel(item)}
              <span>{sportDisplayLabel(item)}</span>
              {item === "Tennis" ? <small>Soon</small> : null}
            </button>
          ))}
        </div>

        <div className="live-league-row">
          <label className="live-centre-search">
            <Compass size={17} />
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Search matches, leagues, teams..." value={query} />
          </label>
          {LIVE_CENTRE_LEAGUES.map((item) => (
            <button className={league === item ? "active" : ""} key={item} onClick={() => setLeague(item)} type="button">
              {item === "All Live" ? <span className="live-dot" /> : null}
              {item}
            </button>
          ))}
        </div>

        <a className="live-create-tournament" href="/?create=market">
          <span>{sportIconLabel(sport)}</span>
          <strong>Create Tournament</strong>
          <small>Build from Bento fixtures</small>
          <Plus size={18} />
        </a>
      </section>

      {tab === "stats" ? (
        <section className="live-stat-grid">
          <LiveStatCard icon={<Gauge size={20} />} label="Total feed items" value={stats.matches} />
          <LiveStatCard icon={<Flame size={20} />} label="Live now" value={stats.live} />
          <LiveStatCard icon={<Clock3 size={20} />} label="Upcoming" value={stats.upcoming} />
          <LiveStatCard icon={<Trophy size={20} />} label="Sports covered" value={stats.sports} />
        </section>
      ) : null}

      {tab === "news" ? (
        <section className="live-news-list">
          {newsRows.length ? newsRows.map((item) => (
            <article className="live-news-card" key={item.id}>
              <small>{item.source}</small>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </article>
          )) : <div className="live-empty-state">No Bento news slice is available for this filter yet.</div>}
        </section>
      ) : (
        <section className="live-board-card">
          <div className="live-board-tabs">
            {["matches", "standings", "results"].map((item) => (
              <button className={section === item ? "active" : ""} key={item} onClick={() => setSection(item)} type="button">
                {titleCase(item)}
              </button>
            ))}
            <button className="live-refresh" disabled={loading} onClick={() => loadLiveCentre({ refresh: true })} type="button">
              <Flame size={15} />
              Refresh
            </button>
          </div>

          {loading ? (
            <LiveCentreSkeleton />
          ) : error && !rows.length ? (
            <div className="live-empty-state">{error}</div>
          ) : section === "standings" ? (
            <div className="live-standings-list">
              {standings.length ? standings.map((row) => <LiveStandingRow key={`${row.league}-${row.sport}`} row={row} />) : <div className="live-empty-state">No standings for this filter yet.</div>}
            </div>
          ) : filteredRows.length ? (
            <div className="live-match-list">
              {filteredRows.map((row) => <LiveMatchCard key={row.id} row={row} />)}
            </div>
          ) : (
            <div className="live-empty-state">No Bento events match this filter yet.</div>
          )}
        </section>
      )}
    </main>
  );
}

function LiveStatCard({ icon, label, value }) {
  return (
    <article className="live-stat-card">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function LiveMatchCard({ row }) {
  return (
    <article className="live-match-card">
      <div>
        <span className={`live-status-pill ${row.status}`}>{row.status}</span>
        <strong>{row.title}</strong>
        <small>{row.subtitle || row.league}</small>
      </div>
      <div className="live-match-meta">
        <span>{row.league}</span>
        <span>{formatExplorerDate(row.startsAt) || "Time TBA"}</span>
        {row.slug ? <a href={`/tournaments/${encodeURIComponent(row.slug)}`}>Enter</a> : null}
      </div>
      <div className="live-match-stats">
        <b>{row.entries || 0}</b>
        <span>entries</span>
        <b>{formatExplorerPrize(row.pool, "usdc") || "Bento"}</b>
        <span>pool</span>
      </div>
    </article>
  );
}

function LiveStandingRow({ row }) {
  return (
    <article className="live-standing-row">
      <span>{row.rank}</span>
      <strong>{row.league}</strong>
      <small>{row.sport}</small>
      <b>{row.live} live</b>
      <b>{row.total} events</b>
    </article>
  );
}

function LiveCentreSkeleton() {
  return (
    <div className="live-match-list">
      {Array.from({ length: 3 }, (_, index) => (
        <article className="live-match-card skeleton" key={`live-skeleton-${index}`}>
          <SkeletonLine width="42%" />
          <SkeletonLine width="72%" />
          <SkeletonLine width="28%" />
        </article>
      ))}
    </div>
  );
}

function liveCentreStandings(rows = []) {
  const byLeague = new Map();
  for (const row of rows) {
    const key = `${row.sport}-${row.league}`;
    const current = byLeague.get(key) || { league: row.league || "Bento", sport: row.sport, live: 0, total: 0 };
    current.total += 1;
    if (row.status === "live") current.live += 1;
    byLeague.set(key, current);
  }
  return [...byLeague.values()].sort((left, right) => right.live - left.live || right.total - left.total)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function liveCentreNewsRows(rows = [], feeds = {}) {
  const feedNews = listFrom(feeds.news?.data || feeds.news?.items || feeds.news).map((item, index) => ({
    id: String(item.id || `news-${index}`),
    title: String(item.title || item.name || "Bento feed update"),
    body: String(item.summary || item.description || item.body || "Fresh from the Bento feed API."),
    source: "Bento news",
  }));
  if (feedNews.length) return feedNews.slice(0, 8);
  return rows.slice(0, 8).map((row) => ({
    id: `catalog-${row.id}`,
    title: `${row.title} listed`,
    body: `${row.sport} ${row.status} item available from the Bento tournament feed.`,
    source: row.source || "Bento catalog",
  }));
}

function sportDisplayLabel(value) {
  return value === "American Football" ? "NFL" : value === "Formula 1" ? "F1" : value;
}

function sportIconLabel(value) {
  return ({
    Football: "F",
    Cricket: "C",
    "Formula 1": "F1",
    "American Football": "NFL",
    Basketball: "B",
    Baseball: "MLB",
    Tennis: "T",
  })[value] || "B";
}

function LeaderboardPage() {
  const [users, setUsers] = useState(loadProfiles);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("USDC");
  const [range, setRange] = useState("all");
  const [metric, setMetric] = useState("pnl");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const normalized = users.map(normalizeProfile);
    const ranked = leaderboardRows(normalized);
    const filtered = ranked.filter((row) => {
      const haystack = `${row.name} ${row.username} ${row.wallet}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });
    return metric === "volume" ? [...filtered].sort((a, b) => b.volume - a.volume) : filtered;
  }, [metric, query, users]);
  const summary = leaderboardSummary(users.map(normalizeProfile));
  const topValue = currency === "Credits" ? Math.round(summary.totalVolume / 12) : summary.totalVolume;

  useEffect(() => {
    let alive = true;
    fetchLeaderboardUsers()
      .then((nextUsers) => {
        if (alive && nextUsers.length) setUsers(nextUsers);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="leaderboard-shell">
      <header className="leaderboard-topbar">
        <a className="back-link" href="/">haramball.xyz</a>
        <h1>Leaderboard</h1>
        <a className="portfolio-refresh" href="/portfolio">Portfolio</a>
      </header>

      <section className="leaderboard-prize">
        <Trophy size={78} />
        <div>
          <strong>{currency === "Credits" ? `${formatCompact(topValue)} CR` : `$${formatCompact(topValue)}`}</strong>
          <span><Wallet size={14} /> Connect wallet to join</span>
        </div>
        <Trophy size={78} />
      </section>

      <div className="leaderboard-currency-tabs">
        {["USDC", "Credits"].map((item) => (
          <button className={currency === item ? "active" : ""} key={item} onClick={() => setCurrency(item)} type="button">{item}</button>
        ))}
      </div>

      <section className="leaderboard-metric-grid">
        <LeaderboardMetricCard label="Total Volume" value={formatCompact(summary.totalVolume)} series={[2, 2, 3, 4, 8, 11]} />
        <LeaderboardMetricCard label="Active Participants" value={summary.traders} series={[1, 2, 2.4, 3, 3, 5]} />
      </section>

      <section className="leaderboard-table-card">
        <div className="leaderboard-table-tools">
          <div className="leaderboard-range-tabs">
            {["all", "today", "week", "month"].map((item) => (
              <button className={range === item ? "active" : ""} key={item} onClick={() => setRange(item)} type="button">{titleCase(item)}</button>
            ))}
          </div>
          <div className="leaderboard-right-tools">
            <div className="leaderboard-metric-toggle">
              <button className={metric === "pnl" ? "active" : ""} onClick={() => setMetric("pnl")} type="button">P&L</button>
              <button className={metric === "volume" ? "active" : ""} onClick={() => setMetric("volume")} type="button">Volume</button>
            </div>
            <label className="leaderboard-search">
              <Compass size={16} />
              <input onChange={(event) => setQuery(event.target.value)} placeholder="Search..." value={query} />
            </label>
          </div>
        </div>

        <div className="leaderboard-table-head">
          <span>#</span>
          <span>Trader</span>
          <span>P&L</span>
          <span>Volume</span>
          <span>Win Rate</span>
        </div>
        {loading ? (
          <div className="portfolio-state">Loading leaderboard...</div>
        ) : rows.length ? (
          <div className="leaderboard-full-list">
            {rows.map((row) => <LeaderboardFullRow key={row.id} row={row} />)}
          </div>
        ) : (
          <div className="portfolio-state">No traders match this search.</div>
        )}
      </section>
    </main>
  );
}

function LeaderboardMetricCard({ label, value, series }) {
  const points = series.map((value, index) => `${index * 20},${110 - value * 9}`).join(" ");
  return (
    <article className="leaderboard-metric-card">
      <span><Gauge size={16} /> {label}</span>
      <strong>{typeof value === "number" ? value : `$${value}`}</strong>
      <svg viewBox="0 0 100 120" role="img" aria-label={`${label} trend`}>
        <polyline points={points} fill="none" stroke="#087cff" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
    </article>
  );
}

function LeaderboardFullRow({ row }) {
  const positive = row.pnl >= 0;
  return (
    <article className="leaderboard-full-row">
      <span className={`leaderboard-medal rank-${Math.min(row.rank, 3)}`}>{row.rank <= 3 ? row.rank : row.rank}</span>
      <div className="leaderboard-trader">
        <b>{row.initials}</b>
        <div>
          <strong>{row.name}</strong>
          <small>{row.wallet ? shortAddress(row.wallet) : `@${row.username || "player"}`}</small>
        </div>
      </div>
      <strong className={positive ? "positive" : "negative"}>{positive ? "+" : "-"}${formatCompact(Math.abs(row.pnl))}</strong>
      <strong>${formatCompact(row.volume)}</strong>
      <div className="leaderboard-winrate">
        <i><span style={{ width: `${row.winRate}%` }} /></i>
        <b>{row.winRate}%</b>
      </div>
    </article>
  );
}

function PortfolioPage() {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("positions");
  const [chartMode, setChartMode] = useState("cumulative");
  const [range, setRange] = useState("all");
  const token = sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || "";
  const account = sessionStorage.getItem(SESSION_ACCOUNT_STORAGE_KEY) || sessionStorage.getItem(SESSION_WALLET_STORAGE_KEY) || "";
  const summary = portfolioSummary(portfolio);
  const positions = portfolioPositions(portfolio);
  const tabs = [
    ["positions", "Positions", <Coins size={16} />],
    ["history", "History", <Clock3 size={16} />],
    ["parlays", "Parlays", <BadgeDollarSign size={16} />],
    ["tournaments", "Tournaments", <Trophy size={16} />],
    ["deposits", "Deposit History", <Wallet size={16} />],
    ["withdrawals", "Withdrawal History", <ChevronDown size={16} />],
  ];

  const loadPortfolio = async () => {
    if (!token && !account) {
      setError("Connect a Bento wallet from the home page to load portfolio data.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      setPortfolio(await fetchBentoPortfolio({ token, account }));
    } catch (nextError) {
      setError(nextError.message || "Portfolio failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolio();
  }, []);

  return (
    <main className="portfolio-shell">
      <header className="portfolio-topbar">
        <a className="back-link" href="/">haramball.xyz</a>
        <div>
          <h1>Portfolio</h1>
          <p>{account ? `Market account ${shortAddress(account)}` : "Bento account scope"}</p>
        </div>
        <button className="portfolio-refresh" onClick={loadPortfolio} type="button">Refresh</button>
      </header>

      <section className="portfolio-overview">
        <div className="portfolio-wallet-stack">
          <article className="portfolio-balance-card">
            <div className="portfolio-segment">
              <button className="active" type="button">Pro</button>
              <button type="button">Free to Play</button>
            </div>
            <span>Bento Balance</span>
            <strong>${summary.balance}</strong>
            <button className="portfolio-primary" type="button">Add Funds</button>
          </article>
          <article className="portfolio-balance-card secondary">
            <strong>${summary.totalValue}</strong>
            <span>Bento Account</span>
            <div className="portfolio-action-row">
              <button type="button">Add Funds</button>
              <button type="button">Withdraw</button>
            </div>
          </article>
        </div>

        <article className="portfolio-chart-card">
          <div className="portfolio-chart-head">
            <span className="portfolio-chart-icon"><Gauge size={18} /></span>
            <div className="portfolio-segment compact">
              <button className="active" type="button">Predictions</button>
              <button type="button">Liquidity</button>
            </div>
            <select onChange={(event) => setChartMode(event.target.value)} value={chartMode}>
              <option value="cumulative">Cumulative</option>
              <option value="daily">Daily</option>
            </select>
            <div className="portfolio-range">
              {["24h", "7d", "30d", "all"].map((item) => (
                <button className={range === item ? "active" : ""} key={item} onClick={() => setRange(item)} type="button">{item === "all" ? "All" : item}</button>
              ))}
            </div>
          </div>
          <div className="portfolio-chart-body">
            {loading ? "Loading chart..." : error ? error : positions.length ? "Portfolio performance updates after Bento returns chart snapshots." : "No portfolio history yet."}
          </div>
          <div className="portfolio-chart-stats">
            <span><small>Total predictions</small><b>{summary.positionsCount}</b></span>
            <span><small>Created</small><b>{summary.marketsCreated}</b></span>
            <span><small>P/L</small><b>${summary.pnl}</b></span>
          </div>
        </article>
      </section>

      <section className="portfolio-tabs" aria-label="Portfolio sections">
        {tabs.map(([id, label, icon]) => (
          <button className={tab === id ? "active" : ""} key={id} onClick={() => setTab(id)} type="button">
            {icon}
            {label}
          </button>
        ))}
      </section>

      <section className="portfolio-content">
        {tab === "positions" ? (
          loading ? <PortfolioLoading label="Loading positions..." /> : positions.length ? <PortfolioPositions rows={positions} /> : <PortfolioEmpty label={error || "No open Bento positions yet."} />
        ) : (
          <PortfolioEmpty label={`${tabs.find(([id]) => id === tab)?.[1]} will appear here when Bento returns account events.`} />
        )}
      </section>
    </main>
  );
}

function PortfolioPositions({ rows }) {
  return (
    <div className="portfolio-position-list">
      {rows.map((position) => (
        <article className="portfolio-position-row" key={position.id}>
          <div>
            <strong>{position.title}</strong>
            <span>{position.outcome} - {position.status}</span>
          </div>
          <b>{position.shares || "--"} shares</b>
          <b>{position.value ? `$${position.value}` : "--"}</b>
        </article>
      ))}
    </div>
  );
}

function PortfolioLoading({ label }) {
  return <div className="portfolio-state">{label}</div>;
}

function PortfolioEmpty({ label }) {
  return <div className="portfolio-state">{label}</div>;
}

function LeaderboardCard({ loading = false, profiles, wide = false }) {
  return (
    <article className={`leaderboard-card ${wide ? "wide" : ""}`}>
      <h2>
        <Trophy size={17} />
        Local Top 5
        <span className="section-tag">Local cache</span>
      </h2>
      <div className="leaderboard-list">
        {loading ? (
          <LeaderboardSkeleton />
        ) : profiles.length === 0 ? (
          <div className="leaderboard-empty">No live players yet</div>
        ) : profiles.map((profile, index) => (
          <a className="leaderboard-row" href={`/@${profile.username || usernameFrom(profile.name)}`} key={profile.id}>
            <span className={`rank rank-${index + 1}`}>{index < 3 ? <Medal size={15} /> : index + 1}</span>
            <div>
              <strong>{profile.name}</strong>
              <small>Local @{profile.username || usernameFrom(profile.name)} - {profile.team} - {profile.wins}W / {profile.losses}L</small>
            </div>
            <b>{profile.wins}-{profile.losses}</b>
          </a>
        ))}
      </div>
    </article>
  );
}

function ProfileActivityCard({ activeProfile, fallbackToFirst = true, feed, loading = false, profiles, wide = false }) {
  const profile = activeProfile || (fallbackToFirst ? profiles[0] : null) || null;
  const wins = profile?.wins || 0;
  const losses = profile?.losses || 0;
  const total = Math.max(1, wins + losses);
  const winRate = Math.round((wins / total) * 100);
  const activity = buildActivityCells(feed);
  const logItems = feed.slice(0, 5);

  return (
    <article className={`profile-activity-card ${wide ? "wide" : ""}`}>
      <h2>
        <UserCircle size={17} />
        Profile
      </h2>
      {loading ? (
        <ProfileActivitySkeleton />
      ) : profile ? (
        <>
          <div className="player-profile-panel">
            <span className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</span>
            <div className="profile-copy">
              <strong>{profile.name}</strong>
              <small>@{profile.username || usernameFrom(profile.name)} - {profile.team} - {profile.style}</small>
            </div>
            <div className="record-stack" aria-label={`${wins} wins and ${losses} losses`}>
              <span className="record-pill wins">{wins}W</span>
              <span className="record-pill losses">{losses}L</span>
            </div>
          </div>
          <div className="profile-metrics">
            <span>
              <small>Win rate</small>
              <b>{winRate}%</b>
            </span>
            <span>
              <small>Wins</small>
              <b>{wins}</b>
            </span>
            <span>
              <small>Activity</small>
              <b>{feed.length}</b>
            </span>
          </div>
          <div className="activity-grid" aria-label="Interaction activity">
            {activity.map((cell, index) => (
              <span className={`activity-cell level-${cell}`} key={`activity-${index}`} title={`${cell} interactions`} />
            ))}
          </div>
          <div className="activity-log">
            {logItems.length ? logItems.map((item, index) => (
              <div className="activity-log-row" key={`${item.minute}-${item.label}-${index}`}>
                <strong>{item.minute}</strong>
                <span>{item.label}</span>
              </div>
            )) : (
              <div className="activity-log-row">
                <strong>{timeStamp()}</strong>
                <span>No activity yet</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="leaderboard-empty">Create a profile to track activity</div>
      )}
    </article>
  );
}

function MarketCreatorModal({ creating, draft, onClose, onSubmit, setDraft }) {
  const yesNo = draft.type !== "versus";
  const update = (patch) => setDraft((value) => ({ ...value, ...patch }));

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="market-creator-modal" role="dialog" aria-modal="true" aria-label="Create Bento market">
        <div className="modal-hero">
          <div>
            <span className="category">Bento Creator</span>
            <h2>Create New Market</h2>
            <p>Create a Bento YES/NO or versus market from haramball.xyz.</p>
          </div>
          <button className="profile-icon-button modal-close" disabled={creating} onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <form className="market-creator-body" onSubmit={onSubmit}>
          <div className="market-creator-fields">
            <div className="market-type-toggle" aria-label="Market type">
              {[
                ["prediction", "Yes/No"],
                ["versus", "Versus"],
              ].map(([value, label]) => (
                <button className={draft.type === value ? "active" : ""} key={value} onClick={() => update({ type: value })} type="button">
                  {label}
                </button>
              ))}
            </div>

            <div className="market-type-toggle" aria-label="Market collateral">
              {[
                ["usdc", "USD"],
                ["credits", "Credits"],
              ].map(([value, label]) => (
                <button className={draft.collateralMode === value ? "active" : ""} key={value} onClick={() => update({ collateralMode: value })} type="button">
                  {label}
                </button>
              ))}
            </div>

            <label>
              <span>Market name</span>
              <input
                maxLength={200}
                onChange={(event) => update({ question: event.target.value })}
                placeholder="Will India win their next T20?"
                value={draft.question}
              />
            </label>

            <label>
              <span>Category</span>
              <select onChange={(event) => update({ category: event.target.value })} value={draft.category}>
                {MARKET_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>

            <div className="market-option-grid">
              <label>
                <span>{yesNo ? "Yes label" : "Option A"}</span>
                <input maxLength={40} onChange={(event) => update({ optionA: event.target.value })} value={draft.optionA} />
              </label>
              <label>
                <span>{yesNo ? "No label" : "Option B"}</span>
                <input maxLength={40} onChange={(event) => update({ optionB: event.target.value })} value={draft.optionB} />
              </label>
            </div>

            <label>
              <span>Resolution rules</span>
              <textarea
                maxLength={1000}
                onChange={(event) => update({ description: event.target.value })}
                placeholder="Resolve YES if the official result source confirms the outcome before the end time."
                value={draft.description}
              />
            </label>

            <div className="market-option-grid">
              <label>
                <span>Start</span>
                <input onChange={(event) => update({ startTime: event.target.value })} type="datetime-local" value={draft.startTime} />
              </label>
              <label>
                <span>End</span>
                <input onChange={(event) => update({ endTime: event.target.value })} type="datetime-local" value={draft.endTime} />
              </label>
            </div>

            <label>
              <span>Cover image URL</span>
              <input
                onChange={(event) => update({ coverImageUrl: event.target.value })}
                placeholder="https://..."
                value={draft.coverImageUrl}
              />
            </label>

            <div className="market-type-toggle" aria-label="Market sharing">
              {[
                ["private", "Private"],
                ["public", "Public"],
              ].map(([value, label]) => (
                <button className={draft.privacyAccess === value ? "active" : ""} key={value} onClick={() => update({ privacyAccess: value })} type="button">
                  {value === "private" ? <Lock size={15} /> : <Globe size={15} />}
                  {label}
                </button>
              ))}
            </div>

            <button className="activate-button" disabled={creating} type="submit">
              <Plus size={17} />
              {creating ? "Creating..." : "Create on Bento"}
            </button>
          </div>

          <aside className="market-create-preview">
            <span>{draft.privacyAccess === "private" ? <Lock size={14} /> : <Globe size={14} />} {draft.privacyAccess} Market</span>
            <div className="market-create-image">{draft.coverImageUrl ? <img alt="" src={draft.coverImageUrl} /> : "Preview Image"}</div>
            <h3>{draft.question || "Market Name"}</h3>
            <div className="market-create-odds">
              <b>0%</b>
              <i />
              <b>0%</b>
            </div>
            <div className="market-create-outcomes">
              <strong>{draft.optionA || "YES"}</strong>
              <strong>{draft.optionB || "NO"}</strong>
            </div>
            <small>{draft.category} - {draft.collateralMode.toUpperCase()}</small>
          </aside>
        </form>
      </section>
    </div>
  );
}

function PrivateGroupCard({ group, onOpen, wide = false }) {
  return (
    <article className={`private-group-card ${wide ? "wide" : ""}`}>
      <h2><Lock size={17} /> Private Group</h2>
      {group ? (
        <>
          <div className="private-group-summary">
            <strong>{group.name}</strong>
            <span>{group.members.length} members - {group.invites.length} invites</span>
            <b>{group.code}</b>
          </div>
          <div className="private-group-actions">
            <button className="activate-button" onClick={() => onOpen("invite")} type="button">Invite friends</button>
            <button className="chip" onClick={() => onOpen("join")} type="button">Join another</button>
          </div>
        </>
      ) : (
        <>
          <p>Create a private matchday group, invite friends by username or email, and share one link.</p>
          <div className="private-group-actions">
            <button className="activate-button" onClick={() => onOpen("create")} type="button">Create group</button>
            <button className="chip" onClick={() => onOpen("join")} type="button">Join with code</button>
          </div>
        </>
      )}
    </article>
  );
}

function PrivateGroupModal({
  activeGroup,
  draft,
  inviteLink,
  mode,
  onClose,
  onCopyLink,
  onCreate,
  onInvite,
  onJoin,
  setDraft,
  setMode,
}) {
  const title = mode === "join" ? "Join private group" : mode === "invite" ? "Invite friends" : "Create private group";

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="private-group-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-hero">
          <div>
            <span className="category">Private Markets</span>
            <h2>{title}</h2>
            <p>Build a small group for friends, usernames, email invites, and shareable links.</p>
          </div>
          <button className="profile-icon-button modal-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="private-group-tabs" role="tablist" aria-label="Private group modes">
          {["create", "invite", "join"].map((item) => (
            <button className={mode === item ? "active" : ""} key={item} onClick={() => setMode(item)} type="button">
              {item}
            </button>
          ))}
        </div>

        {mode === "create" ? (
          <form className="private-group-form" onSubmit={onCreate}>
            <label>
              <span>Group name</span>
              <input
                maxLength={40}
                onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
                placeholder="Friday football picks"
                value={draft.name}
              />
            </label>
            <button className="activate-button" type="submit">Create private group</button>
          </form>
        ) : null}

        {mode === "invite" ? (
          <form className="private-group-form" onSubmit={onInvite}>
            {activeGroup ? (
              <div className="private-group-invite-link">
                <span>Invite link</span>
                <strong>{inviteLink}</strong>
                <button className="chip" onClick={onCopyLink} type="button">Copy link</button>
              </div>
            ) : (
              <div className="wallet-empty">
                <strong>No private group yet</strong>
                <span>Create a group first, then invite friends.</span>
              </div>
            )}
            <label>
              <span>Username or email</span>
              <input
                maxLength={80}
                onChange={(event) => setDraft((value) => ({ ...value, invite: event.target.value }))}
                placeholder="@friend or friend@mail.com"
                value={draft.invite}
              />
            </label>
            <button className="activate-button" disabled={!activeGroup} type="submit">Add invite</button>
            {activeGroup?.invites?.length ? (
              <div className="private-group-list">
                {activeGroup.invites.map((invite) => <span key={invite.target}>{invite.target}</span>)}
              </div>
            ) : null}
          </form>
        ) : null}

        {mode === "join" ? (
          <form className="private-group-form" onSubmit={onJoin}>
            <label>
              <span>Invitation code</span>
              <input
                maxLength={12}
                onChange={(event) => setDraft((value) => ({ ...value, code: event.target.value.toUpperCase() }))}
                placeholder="Enter invite..."
                value={draft.code}
              />
            </label>
            <button className="activate-button" type="submit">Join group</button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

function OnboardingModal({
  activeProfile,
  authMode,
  connectWallet,
  connectWithWalletLink,
  draft,
  linkLoading,
  mode,
  onClose,
  onSubmit,
  setDraft,
  wallet,
  walletLoading,
  walletOptions,
  walletOptionsLoading,
}) {
  const isOnboarding = mode === "onboarding";
  const isSettings = mode === "settings";
  const title = isOnboarding ? "Join Matchday" : isSettings ? "Account Settings" : "Edit Fan Profile";
  const body = isOnboarding
    ? "Create a fan profile first. Connect your wallet now or later when you are ready to lock a ticket."
    : isSettings
      ? "Manage your matchday identity and wallet connection."
      : "Update how you show up on the leaderboard.";

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="onboarding-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-hero">
          <div>
            <span className="category">Match Markets</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </div>
          <button className="profile-icon-button modal-close" disabled={isOnboarding && !activeProfile} onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        {isSettings ? (
          <div className="settings-grid">
            <div className="wallet-selector" aria-label="Choose wallet">
              <strong>Choose wallet</strong>
              {walletOptionsLoading ? (
                <WalletSkeleton />
              ) : walletOptions.length ? (
                walletOptions.map((option) => (
                  <button
                    className="wallet-option available"
                    disabled={walletLoading}
                    key={option.id}
                    onClick={() => connectWallet(option)}
                    type="button"
                  >
                    <span>{option.name}</span>
                    <small>{walletLoading ? <SkeletonLine width="62%" small /> : option.hint}</small>
                  </button>
                ))
              ) : (
                <div className="wallet-empty">
                  <strong>No browser wallet found</strong>
                  <span>Open wallet link or install MetaMask, Rabby, Coinbase Wallet, or another EVM wallet.</span>
                </div>
              )}
            </div>
            <button className="wallet-button alt" onClick={connectWithWalletLink} disabled={linkLoading} type="button">
              <Wallet size={17} />
              {linkLoading ? <SkeletonLine width="94px" /> : "Open wallet link"}
            </button>
            <div className="settings-note">
              <strong>{activeProfile?.name || "No profile yet"}</strong>
              <span>
                {wallet
                  ? `${authMode === "wallet" ? "Trading wallet" : "Linked wallet"} ${shortAddress(wallet)}`
                  : "Use wallet link if no extension appears in this browser."}
              </span>
            </div>
          </div>
        ) : null}

        {!isSettings ? (
          <ProfileBuilder
            activeProfile={activeProfile}
            draft={draft}
            setDraft={setDraft}
            onSubmit={onSubmit}
            submitLabel={isOnboarding ? "Enter Matchday" : "Save Profile"}
          />
        ) : (
          <ProfileBuilder
            activeProfile={activeProfile}
            draft={draft}
            setDraft={setDraft}
            onSubmit={onSubmit}
            submitLabel="Save Profile"
          />
        )}
      </section>
    </div>
  );
}

function ProfileBuilder({ draft, setDraft, onSubmit, activeProfile, submitLabel = "Create Profile", wide = false }) {
  return (
    <article className={`profile-card ${wide ? "wide" : ""}`}>
      {activeProfile ? (
        <div className="profile-preview">
          <span>{teamFlag(activeProfile.team)}</span>
          <div>
            <strong>{activeProfile.name}</strong>
            <small>{activeProfile.team} - {activeProfile.style} - {activeProfile.wins} wins</small>
          </div>
        </div>
      ) : null}
      <form className="profile-form" onSubmit={onSubmit}>
        <label>
          <span>Display name</span>
          <input
            maxLength={18}
            onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
            placeholder="Your matchday name"
            value={draft.name}
          />
        </label>
        <label>
          <span>Username</span>
          <input
            maxLength={18}
            onChange={(event) => setDraft((value) => ({ ...value, username: event.target.value }))}
            placeholder="username"
            value={draft.username}
          />
        </label>
        <label>
          <span>Team</span>
          <select onChange={(event) => setDraft((value) => ({ ...value, team: event.target.value }))} value={draft.team}>
            {["USA", "Argentina", "Brazil", "England", "France", "Germany", "Japan", "Morocco"].map((team) => (
              <option key={team}>{team}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Style</span>
          <select onChange={(event) => setDraft((value) => ({ ...value, style: event.target.value }))} value={draft.style}>
            {["Striker", "Midfield", "Defense", "Chaos", "Underdog"].map((style) => (
              <option key={style}>{style}</option>
            ))}
          </select>
        </label>
        <fieldset className="socials-fieldset">
          <legend>Optional socials</legend>
          <label>
            <span>X / Twitter</span>
            <input
              maxLength={32}
              onChange={(event) => setDraft((value) => ({ ...value, twitter: event.target.value }))}
              placeholder="@handle"
              value={draft.twitter}
            />
          </label>
          <label>
            <span>Discord</span>
            <input
              maxLength={32}
              onChange={(event) => setDraft((value) => ({ ...value, discord: event.target.value }))}
              placeholder="discord handle"
              value={draft.discord}
            />
          </label>
        </fieldset>
        <button className="activate-button" type="submit">
          <UserPlus size={17} />
          {submitLabel}
        </button>
      </form>
    </article>
  );
}

function Team({ flag, name, sublabel, stat, align = "left" }) {
  return (
    <div className={`team ${align === "right" ? "right" : ""}`}>
      {flag ? <span className="team-flag" aria-hidden="true">{flag}</span> : null}
      <strong>{name}</strong>
      {sublabel ? <span>{sublabel} <b>{stat}</b></span> : null}
    </div>
  );
}

function chooseRandomPick(market) {
  const options = [market?.optionA, market?.optionB].filter(Boolean);
  const fallbackLabel = options[0] || "Random side";
  const index = Math.random() < 0.5 ? 0 : 1;
  return {
    index: options.length > 1 ? index : 0,
    label: options[index] || fallbackLabel,
  };
}

function SettlementCard({ estimate, estimateLoading, market, pick, placing, settlement, stake, stakeCurrency }) {
  if (estimateLoading || placing) {
    return (
      <article className="settlement-card">
        <h2>Your Ticket</h2>
        <div className="result">
          <SkeletonBox className="result-icon" />
          <div>
            <SkeletonLine width="68%" />
            <SkeletonLine width="92%" small />
          </div>
          <SkeletonLine width="54px" />
        </div>
      </article>
    );
  }

  const selectedOutcome = pick === 0 ? market?.optionA : pick === 1 ? market?.optionB : "";
  const stakeAmount = Number.isFinite(Number(stake)) ? Number(stake) : 0;
  const estimateAmount = Number(weiToHuman(estimate?.sharesOut || "0"));
  const winAmount = estimate?.sharesOut && Number.isFinite(estimateAmount) && estimateAmount > 0 ? estimateAmount : stakeAmount;
  const hasPreview = Boolean(selectedOutcome);
  const iconClass = hasPreview ? (pick === 0 ? "yes" : "no") : settlement.tone;

  return (
    <article className="settlement-card">
      <h2>Your Ticket</h2>
      {hasPreview ? (
        <div className="ticket-preview-card">
          <span className={`result-icon ${iconClass}`}>{selectedOutcome.slice(0, 1)}</span>
          <div className="ticket-main">
            <strong>{selectedOutcome}</strong>
            <small>{market?.title || "Match market"}</small>
          </div>
          <div className="ticket-stats">
            <span className="ticket-stat upside-win">
              <small>Win</small>
              <b>+{formatMoney(winAmount)} {stakeCurrency}</b>
            </span>
            <span className="ticket-stat stake-risk">
              <small>Lose</small>
              <b>-{formatMoney(stakeAmount)} {stakeCurrency}</b>
            </span>
          </div>
        </div>
      ) : (
        <div className="result">
          <span className={`result-icon ${settlement.tone}`}>{settlement.icon}</span>
          <div>
            <strong>{settlement.title}</strong>
            <p>{settlement.body}</p>
          </div>
          <b>{settlement.payout}</b>
        </div>
      )}
      {settlement.receipt ? (
        <details className="receipt-proof">
          <summary>
            <ShieldCheck size={16} />
            <span>{settlement.receipt.outcome} on market {settlement.receipt.duelId}</span>
            <ChevronDown size={16} />
          </summary>
          <div className="receipt-grid" aria-label="Match ticket receipt">
            {Object.entries(settlement.receipt).map(([key, value]) => (
              <div className={key === "market" ? "receipt-rule" : ""} key={key}>
                <span>{receiptLabel(key)}</span>
                <strong>{String(value)}</strong>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function FeedCard({ feed, loading, portfolio }) {
  const activity = portfolio ? [{ minute: timeStamp(), label: "Account refreshed" }, ...feed] : feed;
  return (
    <article className="feed-card">
      <h2>Local Activity</h2>
      <div className="feed-list">
        {loading ? (
          <FeedSkeleton />
        ) : activity.length === 0 ? (
          <div className="feed-item empty">
            <strong>{timeStamp()}</strong>
            <span>Waiting for live match events</span>
          </div>
        ) : (
          activity.map((item, index) => (
            <div className="feed-item" key={`${item.minute}-${item.label}-${index}`}>
              <strong>{item.minute}</strong>
              <span>{item.label}</span>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function MarketIntelCard({ analytics, error, shares }) {
  const snapshots = listFrom(analytics?.yesPercentageSnapshots?.data ?? analytics?.yesPercentageSnapshots?.snapshots ?? analytics?.yesPercentageSnapshots);
  const latestSnapshot = snapshots.at(-1) || {};
  const yesPercent = latestSnapshot.yesPercentage ?? latestSnapshot.yes_percentage ?? latestSnapshot.percentage;
  const liquidity = analytics?.sellUnlockLiquidity?.liquidity ?? analytics?.sellUnlockLiquidity?.amount ?? analytics?.sellUnlockLiquidity?.data?.liquidity;
  const shareRows = listFrom(shares?.balances ?? shares?.shares ?? shares?.data ?? shares);

  return (
    <article className="market-intel-card">
      <h2>Bento Market Intel</h2>
      {error ? <p className="market-intel-error">{error}</p> : null}
      <div className="market-intel-grid">
        <span>
          <small>YES history</small>
          <b>{yesPercent === undefined ? "No chart" : `${Number(yesPercent).toFixed(1)}%`}</b>
        </span>
        <span>
          <small>Sell liquidity</small>
          <b>{liquidity === undefined ? "Unavailable" : String(liquidity)}</b>
        </span>
        <span>
          <small>Your shares</small>
          <b>{shareRows.length ? `${shareRows.length} row${shareRows.length === 1 ? "" : "s"}` : "None confirmed"}</b>
        </span>
      </div>
    </article>
  );
}

function ProductModeStack({
  activeGroup,
  activeProfile,
  feed,
  loading,
  onCreateMarket,
  onExplore,
  onOpenGroup,
  profiles,
  statusCards,
}) {
  return (
    <div className="product-mode-stack" aria-label="Product actions">
      <section className="product-mode-actions">
        <button className="activate-button" onClick={onExplore} type="button">
          <Compass size={17} />
          Explore tournaments
        </button>
        <button className="create-market-panel-button compact" onClick={onCreateMarket} type="button">
          <Plus size={17} />
          Create new market
        </button>
      </section>

      <section className="status-grid product-status-grid">
        {statusCards.map((card) => (
          <article className="status-card" key={card.label}>
            <span className="status-icon">{card.icon}</span>
            <small>{card.label}</small>
            <strong>{card.value}</strong>
            <p>{card.body}</p>
          </article>
        ))}
      </section>

      <section className="architecture-panel product-flow-panel">
        <h2>Matchday Flow</h2>
        <div className="rail-item">
          <BadgeDollarSign size={18} />
          <span>Live market board loads before wallet connection</span>
        </div>
        <div className="rail-item">
          <Zap size={18} />
          <span>One wallet signature opens the market account</span>
        </div>
        <div className="rail-item">
          <Trophy size={18} />
          <span>Preview, lock, and track every ticket clearly</span>
        </div>
      </section>

      <PrivateGroupCard group={activeGroup} onOpen={onOpenGroup} />
      <ProfileActivityCard activeProfile={activeProfile} feed={feed} loading={loading} profiles={profiles} />
    </div>
  );
}

function LeaderboardSkeleton() {
  return Array.from({ length: 3 }, (_, index) => (
    <div className="leaderboard-row" key={`leaderboard-skeleton-${index}`}>
      <SkeletonBox className="rank" />
      <div>
        <SkeletonLine width="72%" />
        <SkeletonLine width="54%" small />
      </div>
      <SkeletonLine width="42px" />
    </div>
  ));
}

function FeedSkeleton() {
  return Array.from({ length: 3 }, (_, index) => (
    <div className="feed-item" key={`feed-skeleton-${index}`}>
      <SkeletonLine width="48px" />
      <SkeletonLine width={index === 1 ? "82%" : "64%"} />
    </div>
  ));
}

function ProfileActivitySkeleton() {
  return (
    <>
      <div className="player-profile-panel">
        <SkeletonBox className="profile-avatar" />
        <div>
          <SkeletonLine width="96px" />
          <SkeletonLine width="148px" small />
        </div>
        <SkeletonLine width="56px" />
      </div>
      <div className="activity-grid">
        {Array.from({ length: 28 }, (_, index) => <span className="activity-cell level-0" key={`profile-skeleton-${index}`} />)}
      </div>
    </>
  );
}

function WalletSkeleton() {
  return (
    <>
      {[0, 1].map((index) => (
        <div className="wallet-option" key={`wallet-skeleton-${index}`}>
          <SkeletonLine width="74%" />
          <SkeletonLine width="48%" small />
        </div>
      ))}
    </>
  );
}

function TokenModal({ onCancel, onConfirm, search, selected, setSearch }) {
  const options = TOKEN_OPTIONS.filter((token) => {
    const haystack = `${token.symbol} ${token.name} ${token.network}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });
  const current = TOKEN_OPTIONS.find((token) => token.symbol === selected) || TOKEN_OPTIONS[0];

  return (
    <div className="modal-backdrop token-modal-backdrop" role="presentation">
      <section className="token-modal" role="dialog" aria-modal="true" aria-label="Select token and network">
        <div className="token-modal-head">
          <div>
            <h2>USDC only</h2>
            <p>Launch bets are denominated in USDC. Other assets are not live yet.</p>
          </div>
          <button className="profile-icon-button modal-close" onClick={onCancel} type="button">
            <X size={18} />
          </button>
        </div>
        <label className="token-search">
          <span>Search</span>
          <input autoFocus onChange={(event) => setSearch(event.target.value)} placeholder="Search token or network" value={search} />
        </label>
        <div className="token-list">
          {options.length ? (
            options.map((token) => (
              <button className="token-row active" key={`${token.network}-${token.symbol}`} type="button">
                <span className="token-icon">{token.icon}</span>
                <span>
                  <strong>{token.symbol}</strong>
                  <small>{token.name}</small>
                </span>
                <b>{token.network}</b>
              </button>
            ))
          ) : (
            <div className="wallet-empty">
              <strong>No other tokens yet</strong>
              <span>USDC is the only supported bet currency at launch.</span>
            </div>
          )}
        </div>
        <div className="token-modal-actions">
          <button className="chip" onClick={onCancel} type="button">Cancel</button>
          <button className="activate-button" onClick={onConfirm} type="button">
            Confirm {current.symbol}
          </button>
        </div>
      </section>
    </div>
  );
}

function SkeletonBox({ className = "" }) {
  return <span className={`skeleton-box ${className}`} aria-hidden="true" />;
}

function SkeletonLine({ dark = false, small = false, tall = false, width = "100%" }) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton-line ${dark ? "dark" : ""} ${small ? "small" : ""} ${tall ? "tall" : ""}`}
      style={{ width }}
    />
  );
}

async function discoverEvmWalletOptions() {
  const browserWindow = typeof window === "undefined" ? {} : window;
  const announced = [];

  const onProvider = (event) => {
    if (event?.detail?.provider) announced.push(event.detail);
  };

  if (browserWindow.addEventListener && browserWindow.dispatchEvent) {
    browserWindow.addEventListener("eip6963:announceProvider", onProvider);
    browserWindow.dispatchEvent(new Event("eip6963:requestProvider"));
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    browserWindow.removeEventListener("eip6963:announceProvider", onProvider);
  }

  const ethereum = safeRead(() => browserWindow.ethereum);
  const legacyProviders = Array.isArray(ethereum?.providers) && ethereum.providers.length
    ? ethereum.providers
    : ethereum
      ? [ethereum]
      : [];
  const entries = [
    ...announced.map((detail, index) => ({
      id: detail.info?.uuid || `eip6963-${index}`,
      name: detail.info?.name || evmWalletName(detail.provider, index),
      provider: detail.provider,
      icon: detail.info?.icon,
      source: "eip6963",
    })),
    ...legacyProviders.map((provider, index) => ({
      id: `legacy-${index}-${evmWalletName(provider, index)}`,
      name: evmWalletName(provider, index),
      provider,
      source: "legacy",
    })),
  ];
  const seen = new Set();

  return entries
    .map((entry, index) => {
      const key = `${entry.name}-${providerFingerprint(entry.provider)}`;
      if (seen.has(key)) return null;
      if (entry.source === "legacy" && entries.some((item) => item.source === "eip6963" && item.name === entry.name)) return null;
      seen.add(key);
      const name = entry.name;
      return {
        id: entry.id || `${name}-${index}`,
        name,
        provider: entry.provider,
        hint: entry.source === "eip6963" ? "Detected" : entry.provider?.isConnected?.() ? "Available" : "Detected",
      };
    })
    .filter(Boolean);
}

function evmWalletName(provider, index) {
  if (provider?.isRabby) return "Rabby";
  if (provider?.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider?.isMetaMask && provider?.isBraveWallet) return "Brave Wallet";
  if (provider?.isMetaMask) return "MetaMask";
  if (provider?.isTrust) return "Trust Wallet";
  if (provider?.isFrame) return "Frame";
  if (provider?.isOKExWallet || provider?.isOkxWallet) return "OKX Wallet";
  return index === 0 ? "Browser Wallet" : `Wallet ${index + 1}`;
}

function providerFingerprint(provider) {
  return [
    provider?.isMetaMask ? "metamask" : "",
    provider?.isRabby ? "rabby" : "",
    provider?.isCoinbaseWallet ? "coinbase" : "",
    provider?.isTrust ? "trust" : "",
    provider?.isBraveWallet ? "brave" : "",
    provider?.isFrame ? "frame" : "",
    provider?.isOKExWallet || provider?.isOkxWallet ? "okx" : "",
  ].filter(Boolean).join("-") || "generic";
}

function walletErrorMessage(error) {
  const message = String(error?.message || "").trim();
  const code = error?.code;

  if (code === 4001 || /reject|denied|cancel/i.test(message)) {
    return "Wallet connection cancelled";
  }

  return message || "Wallet connection failed";
}

function safeRead(read) {
  try {
    return read();
  } catch {
    return null;
  }
}

function listFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.items)) return value.items;
  return [value];
}

function receiptLabel(key) {
  return (
    {
      duelId: "market id",
      quoteId: "preview id",
      idempotencyKey: "ticket id",
    }[key] || key
  );
}

function loadProfiles() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "null");
    return Array.isArray(stored) ? stored.map(normalizeProfile) : DEFAULT_PROFILES;
  } catch {
    return DEFAULT_PROFILES;
  }
}

function defaultMarketDraft() {
  const now = new Date();
  const start = new Date(now.getTime() + 15 * 60 * 1000);
  const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  return {
    question: "",
    type: "prediction",
    category: "Football",
    description: "",
    optionA: "YES",
    optionB: "NO",
    startTime: dateTimeLocalValue(start),
    endTime: dateTimeLocalValue(end),
    privacyAccess: "public",
    collateralMode: "usdc",
    coverImageUrl: "",
    tags: ["haramball"],
  };
}

function loadPrivateGroups() {
  try {
    const stored = JSON.parse(localStorage.getItem(PRIVATE_GROUP_STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.map(normalizePrivateGroup) : [];
  } catch {
    return [];
  }
}

function dateTimeLocalValue(date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatCompact(value) {
  const numeric = Number(value) || 0;
  if (Math.abs(numeric) >= 1_000_000) return `${(numeric / 1_000_000).toFixed(numeric >= 10_000_000 ? 0 : 1)}M`;
  if (Math.abs(numeric) >= 1_000) return `${(numeric / 1_000).toFixed(numeric >= 100_000 ? 0 : 1)}K`;
  return numeric.toFixed(Math.abs(numeric) >= 100 ? 0 : 1);
}

function titleCase(value) {
  return String(value || "").slice(0, 1).toUpperCase() + String(value || "").slice(1);
}

function localInputToIso(value) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
}

function loadActivityFeed() {
  try {
    const stored = JSON.parse(localStorage.getItem(ACTIVITY_STORAGE_KEY) || "[]");
    return Array.isArray(stored)
      ? stored.filter((item) => item && item.minute && item.label).slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

function normalizeProfile(profile = {}) {
  const [recordWins, recordLosses] = String(profile.record || "").split("-");
  const wins = numberOr(profile.wins, recordWins, 0);
  const losses = numberOr(profile.losses, recordLosses, 0);

  return {
    id: profile.id,
    name: profile.name,
    username: usernameFrom(profile.username || profile.name),
    team: profile.team || "USA",
    style: profile.style || "Striker",
    twitter: profile.twitter || "",
    discord: profile.discord || "",
    walletId: profile.walletId || profile.wallet || profile.address || "",
    managedAccount: profile.managedAccount || "",
    wins,
    losses,
  };
}

function normalizePrivateGroup(group = {}) {
  return {
    id: String(group.id || `group-${Date.now()}`),
    code: String(group.code || "").toUpperCase() || Math.random().toString(36).slice(2, 8).toUpperCase(),
    name: String(group.name || "Private group").trim(),
    owner: normalizePrivateMember(group.owner),
    members: (Array.isArray(group.members) ? group.members : []).map(normalizePrivateMember).filter((member) => member.username || member.email),
    invites: (Array.isArray(group.invites) ? group.invites : []).map((invite) => ({
      target: String(invite.target || invite.email || invite.username || "").trim(),
      type: String(invite.type || (String(invite.target || "").includes("@") ? "email" : "username")),
    })).filter((invite) => invite.target),
  };
}

function normalizePrivateMember(member = {}) {
  return {
    id: String(member.id || ""),
    name: String(member.name || "").trim(),
    username: usernameFrom(member.username || member.name),
    email: String(member.email || "").trim().toLowerCase(),
  };
}

function inviteLink(code) {
  const base = typeof window === "undefined" ? "" : `${window.location.origin}/`;
  return `${base}?invite=${encodeURIComponent(code)}`;
}

function numberOr(value, fallbackValue, finalFallback) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  const fallback = Number(fallbackValue);
  return Number.isFinite(fallback) ? fallback : finalFallback;
}

function teamFlag(team) {
  return TEAM_FLAGS[team] || "\u{1F3F3}\uFE0F";
}

function timeStamp() {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function buildActivityCells(feed) {
  const cells = Array.from({ length: 28 }, () => 0);
  for (const [index] of (feed || []).entries()) {
    const cellIndex = Math.max(0, cells.length - 1 - index);
    cells[cellIndex] = Math.min(4, cells[cellIndex] + 1);
  }
  return cells;
}

function leagueFromMarket(market) {
  const rawLeague = market?.league || market?.raw?.league || market?.raw?.leagueName || market?.raw?.tournament || market?.raw?.competition;
  const fallback = market?.category && !/^(football|prediction)$/i.test(market.category) ? market.category : "";
  return rawLeague || fallback;
}

function usernameFrom(value) {
  return String(value || "player")
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 18) || "player";
}

function usernameFromProfilePath() {
  const match = window.location.pathname.match(/^\/@([a-z0-9_]+)/i);
  return match ? usernameFrom(match[1]) : "";
}

function marketIdFromPath(pathname = "") {
  const match = String(pathname).match(/^\/markets?\/([^/]+)\/?$/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

function profileIdFrom({ username, walletId, name }) {
  if (walletId) return `wallet-${walletId.toLowerCase()}`;
  return `${usernameFrom(username || name)}-${Date.now()}`;
}

function identityKey(profile) {
  if (profile.walletId) return `wallet:${String(profile.walletId).toLowerCase()}`;
  if (profile.username) return `username:${String(profile.username).toLowerCase()}`;
  return `name:${String(profile.name || "").toLowerCase()}:team:${String(profile.team || "").toLowerCase()}`;
}

function dedupeProfiles(items) {
  const byIdentity = new Map();
  for (const raw of items || []) {
    const profile = normalizeProfile(raw);
    const key = identityKey(profile);
    const existing = byIdentity.get(key);
    if (!existing || profile.wins > existing.wins || profile.losses < existing.losses) {
      byIdentity.set(key, { ...existing, ...profile });
    }
  }
  return [...byIdentity.values()];
}

function attachWalletToProfiles(items, activeProfileId, walletId, managedAccount) {
  return dedupeProfiles((items || []).map((item) => (
    item.id === activeProfileId ? { ...item, walletId, managedAccount: managedAccount || item.managedAccount } : item
  )));
}

createRoot(document.getElementById("root")).render(<App />);
