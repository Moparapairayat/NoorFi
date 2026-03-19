<style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap');

    :root {
        --nf-bg: #f2f6f2;
        --nf-bg-alt: #e8efe9;
        --nf-surface: #ffffff;
        --nf-surface-soft: #eff4f0;
        --nf-border: #d7e2da;
        --nf-border-strong: #a8c4b3;
        --nf-text: #12281f;
        --nf-text-soft: #486055;
        --nf-text-muted: #7a8f84;
        --nf-primary: #1a6b4e;
        --nf-primary-dark: #14543d;
        --nf-accent: #c49a4a;

        --nf-topbar-bg: rgba(255, 255, 255, 0.92);
        --nf-topbar-fg: #355146;
        --nf-brand-text: #103329;

        --nf-sidebar-start: #f4f9f4;
        --nf-sidebar-end: #e8f2eb;
        --nf-sidebar-text: #173126;
        --nf-sidebar-muted: #668072;
        --nf-sidebar-hover: rgba(26, 107, 78, 0.1);
        --nf-sidebar-active-bg: linear-gradient(90deg, rgba(31, 123, 89, 0.2), rgba(196, 154, 74, 0.16));
        --nf-sidebar-active-border: rgba(26, 107, 78, 0.32);

        --nf-card-shadow-sm: 0 1px 2px rgba(18, 40, 31, 0.06);
        --nf-card-shadow-lg: 0 12px 24px rgba(18, 40, 31, 0.08);

        --nf-banner-bg: linear-gradient(90deg, rgba(31, 123, 89, 0.14), rgba(196, 154, 74, 0.12), #ffffff 70%);
        --nf-banner-border: #cfe0d5;
        --nf-chip-bg: rgba(255, 255, 255, 0.95);
        --nf-chip-border: #c9dccc;
        --nf-chip-text: #173126;
        --nf-action-bg: #ffffff;
        --nf-action-border: #bed3c4;
        --nf-action-text: #14543d;
        --nf-action-hover-bg: #f4f9f4;
        --nf-density-tight: 0.56rem;
        --nf-density-normal: 0.72rem;
    }

    html.dark,
    body.dark,
    [data-theme="dark"] {
        --nf-bg: #0b1712;
        --nf-bg-alt: #13211a;
        --nf-surface: #12221a;
        --nf-surface-soft: #172a21;
        --nf-border: #294136;
        --nf-border-strong: #3a5a4b;
        --nf-text: #e8f3ec;
        --nf-text-soft: #c5d7cd;
        --nf-text-muted: #8fa999;
        --nf-primary: #3cad82;
        --nf-primary-dark: #1f7b59;
        --nf-accent: #d1a95b;

        --nf-topbar-bg: rgba(12, 25, 20, 0.9);
        --nf-topbar-fg: #b4c8bc;
        --nf-brand-text: #eaf5ee;

        --nf-sidebar-start: #0b1510;
        --nf-sidebar-end: #12231b;
        --nf-sidebar-text: #d2e6da;
        --nf-sidebar-muted: #86a094;
        --nf-sidebar-hover: rgba(60, 173, 130, 0.12);
        --nf-sidebar-active-bg: linear-gradient(90deg, rgba(31, 123, 89, 0.38), rgba(209, 169, 91, 0.24));
        --nf-sidebar-active-border: rgba(60, 173, 130, 0.48);

        --nf-card-shadow-sm: 0 1px 2px rgba(2, 10, 7, 0.48);
        --nf-card-shadow-lg: 0 14px 30px rgba(2, 10, 7, 0.4);

        --nf-banner-bg: linear-gradient(90deg, rgba(31, 123, 89, 0.3), rgba(209, 169, 91, 0.22), rgba(18, 34, 26, 0.9) 74%);
        --nf-banner-border: #355345;
        --nf-chip-bg: rgba(22, 39, 30, 0.94);
        --nf-chip-border: #375548;
        --nf-chip-text: #e5f2ea;
        --nf-action-bg: #1a3026;
        --nf-action-border: #3f624f;
        --nf-action-text: #dff1e6;
        --nf-action-hover-bg: #233d31;
        --nf-density-tight: 0.56rem;
        --nf-density-normal: 0.72rem;
    }

    html,
    body,
    .fi-body,
    .fi-main {
        font-family: 'DM Sans', 'Segoe UI', sans-serif;
    }

    .fi-body {
        color: var(--nf-text);
        background:
            radial-gradient(circle at 100% 0%, rgba(31, 123, 89, 0.14), transparent 36%),
            radial-gradient(circle at 0% 0%, rgba(196, 154, 74, 0.14), transparent 32%),
            linear-gradient(180deg, var(--nf-bg-alt), var(--nf-bg));
    }

    .fi-main {
        color: var(--nf-text);
    }

    .fi-main-ctn,
    .fi-page,
    .fi-page-main,
    .fi-page-content {
        gap: 0.85rem;
    }

    .fi-page-header-main-ctn {
        margin-bottom: 0.2rem;
    }

    .fi-topbar {
        background: var(--nf-topbar-bg);
        border-bottom: 1px solid var(--nf-border);
        backdrop-filter: blur(14px);
        box-shadow: var(--nf-card-shadow-sm);
    }

    .fi-topbar::before {
        content: '';
        position: absolute;
        inset: 0 0 auto 0;
        height: 2px;
        background: linear-gradient(90deg, var(--nf-primary), var(--nf-accent));
    }

    .fi-topbar .fi-brand {
        color: var(--nf-brand-text) !important;
        font-family: 'Space Grotesk', 'DM Sans', sans-serif;
        font-weight: 700;
        letter-spacing: 0.01em;
    }

    .fi-topbar .fi-breadcrumbs,
    .fi-topbar .fi-breadcrumbs a,
    .fi-topbar .fi-icon-btn,
    .fi-topbar .fi-dropdown-trigger,
    .fi-topbar .fi-user-menu {
        color: var(--nf-topbar-fg) !important;
    }

    .fi-sidebar {
        background: linear-gradient(180deg, var(--nf-sidebar-start) 0%, var(--nf-sidebar-end) 100%);
        border-inline-end: 1px solid var(--nf-border);
    }

    .fi-sidebar .fi-sidebar-nav-group-label {
        color: var(--nf-sidebar-muted) !important;
        letter-spacing: 0.06em;
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        margin-block: 0.4rem 0.3rem;
    }

    .fi-sidebar .fi-sidebar-item-label,
    .fi-sidebar .fi-sidebar-group-button,
    .fi-sidebar .fi-sidebar-item-icon,
    .fi-sidebar .fi-sidebar-group-collapse-button {
        color: var(--nf-sidebar-text) !important;
    }

    .fi-sidebar .fi-sidebar-item-label {
        font-size: 0.92rem;
        font-weight: 650;
        letter-spacing: 0.005em;
    }

    .fi-sidebar .fi-sidebar-group-button {
        font-size: 0.93rem;
        font-weight: 700;
    }

    .fi-sidebar .fi-sidebar-item-icon {
        opacity: 0.9;
    }

    .fi-sidebar .fi-sidebar-item-button {
        border-radius: 0.85rem;
        border: 1px solid transparent;
        margin-block: 0.14rem;
        min-height: 2.5rem;
        padding-block: 0.28rem;
        padding-inline: 0.58rem;
        transition: all 0.16s ease;
    }

    .fi-sidebar .fi-sidebar-item-button:hover {
        background: var(--nf-sidebar-hover) !important;
        border-color: rgba(26, 107, 78, 0.24);
    }

    .fi-sidebar .fi-active.fi-sidebar-item-button {
        background: var(--nf-sidebar-active-bg) !important;
        border-color: var(--nf-sidebar-active-border);
        box-shadow: 0 8px 18px rgba(20, 84, 61, 0.16);
    }

    .fi-sidebar .fi-active.fi-sidebar-item-button .fi-sidebar-item-label,
    .fi-sidebar .fi-active.fi-sidebar-item-button .fi-sidebar-item-icon {
        color: var(--nf-primary-dark) !important;
        font-weight: 800;
        opacity: 1;
    }

    html.dark .fi-sidebar .fi-active.fi-sidebar-item-button .fi-sidebar-item-label,
    body.dark .fi-sidebar .fi-active.fi-sidebar-item-button .fi-sidebar-item-label,
    [data-theme="dark"] .fi-sidebar .fi-active.fi-sidebar-item-button .fi-sidebar-item-label,
    html.dark .fi-sidebar .fi-active.fi-sidebar-item-button .fi-sidebar-item-icon,
    body.dark .fi-sidebar .fi-active.fi-sidebar-item-button .fi-sidebar-item-icon,
    [data-theme="dark"] .fi-sidebar .fi-active.fi-sidebar-item-button .fi-sidebar-item-icon {
        color: #f3faf6 !important;
    }

    .fi-page-header-heading {
        color: var(--nf-text);
        font-family: 'Space Grotesk', 'DM Sans', sans-serif;
        font-size: clamp(1.18rem, 1.45vw, 1.8rem);
        letter-spacing: 0.01em;
    }

    .fi-page-header-subheading {
        color: var(--nf-text-muted);
        max-width: 70ch;
    }

    .fi-section,
    .fi-ta-ctn,
    .fi-widget,
    .fi-wi-stats-overview-stat,
    .fi-fo-field-wrp {
        border-radius: 1.02rem !important;
        border: 1px solid var(--nf-border);
        background: linear-gradient(180deg, var(--nf-surface), var(--nf-surface-soft));
        box-shadow: var(--nf-card-shadow-sm), var(--nf-card-shadow-lg);
    }

    .fi-wi-stats-overview {
        gap: 0.82rem;
    }

    .fi-wi-stats-overview-stat {
        position: relative;
        overflow: hidden;
        border-color: var(--nf-border-strong);
        background:
            radial-gradient(circle at 0% 0%, rgba(26, 107, 78, 0.1), transparent 40%),
            radial-gradient(circle at 100% 0%, rgba(196, 154, 74, 0.12), transparent 38%),
            linear-gradient(180deg, var(--nf-surface), var(--nf-surface-soft));
    }

    .fi-wi-stats-overview-stat::after {
        content: '';
        position: absolute;
        inset: auto 0 0 0;
        height: 2px;
        opacity: 0.48;
        background: linear-gradient(90deg, var(--nf-primary), var(--nf-accent));
        pointer-events: none;
    }

    .fi-wi-stats-overview-stat:hover {
        transform: translateY(-1px);
        box-shadow:
            0 1px 2px rgba(18, 40, 31, 0.08),
            0 16px 28px rgba(18, 40, 31, 0.12);
    }

    .fi-wi-stats-overview-stat-label {
        font-size: 0.8rem;
        letter-spacing: 0.01em;
    }

    .fi-section-content-ctn {
        padding: var(--nf-density-normal);
    }

    .fi-section-content {
        gap: 0.68rem;
    }

    .fi-section-header-heading,
    .fi-wi-stats-overview-stat-label,
    .fi-ta-header-cell {
        color: var(--nf-text);
        font-weight: 700;
    }

    .fi-ta-text,
    .fi-ta-cell,
    .fi-wi-stats-overview-stat-description {
        color: var(--nf-text-soft);
    }

    .fi-wi-stats-overview-stat-value {
        color: var(--nf-text);
        font-family: 'Space Grotesk', 'DM Sans', sans-serif;
        font-size: clamp(1.2rem, 1.5vw, 1.7rem);
        letter-spacing: 0.008em;
    }

    .fi-wi-stats-overview-stat-description {
        font-size: 0.78rem;
        color: var(--nf-text-muted);
    }

    .fi-ta-row:hover {
        background: rgba(26, 107, 78, 0.07);
    }

    .fi-ta-header-cell,
    .fi-ta-cell {
        padding-block: var(--nf-density-tight) !important;
        padding-inline: 0.7rem !important;
    }

    .fi-ta-header-cell {
        font-size: 0.79rem;
        letter-spacing: 0.01em;
    }

    .fi-ta-cell {
        font-size: 0.86rem;
    }

    .fi-ta-text {
        line-height: 1.24;
    }

    .fi-ta-header-cell-sort-btn {
        color: var(--nf-text-soft) !important;
    }

    .fi-ta-header,
    .fi-ta-header-toolbar {
        border: 1px solid var(--nf-border);
        border-radius: 0.86rem;
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.45)),
            linear-gradient(90deg, rgba(26, 107, 78, 0.06), rgba(196, 154, 74, 0.06), transparent 78%);
        box-shadow: var(--nf-card-shadow-sm);
        padding: 0.52rem 0.58rem;
    }

    .fi-ta-header {
        margin-bottom: 0.42rem;
    }

    .fi-ta-header-toolbar {
        margin-top: 0.42rem;
        position: relative;
        overflow: hidden;
    }

    .fi-ta-header-toolbar::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 3px;
        border-radius: 999px;
        background: linear-gradient(180deg, var(--nf-primary), var(--nf-accent));
        opacity: 0.72;
    }

    .fi-ta-header-heading {
        font-family: 'Space Grotesk', 'DM Sans', sans-serif;
        font-size: 1rem;
        color: var(--nf-text);
    }

    .fi-ta-header-description {
        font-size: 0.8rem;
        color: var(--nf-text-muted);
        margin-top: 0.16rem;
    }

    .fi-ta-actions {
        gap: 0.42rem !important;
    }

    .fi-ta-actions .fi-btn {
        min-height: 1.95rem;
        padding-inline: 0.7rem;
        border-radius: 0.68rem !important;
    }

    .fi-ta-filters-before-content-ctn,
    .fi-ta-filters-above-content-ctn,
    .fi-ta-filters-after-content-ctn {
        margin-top: 0.42rem;
        margin-bottom: 0.42rem;
    }

    .fi-ta-filters {
        border: 1px solid var(--nf-border);
        border-radius: 0.86rem;
        background: linear-gradient(180deg, var(--nf-surface), var(--nf-surface-soft));
        box-shadow: var(--nf-card-shadow-sm);
        padding: 0.58rem;
    }

    .fi-ta-filters-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.48rem;
        padding-bottom: 0.38rem;
        border-bottom: 1px solid var(--nf-border);
    }

    .fi-ta-filters-heading {
        font-family: 'Space Grotesk', 'DM Sans', sans-serif;
        font-size: 0.9rem;
        color: var(--nf-text);
        letter-spacing: 0.01em;
    }

    .fi-ta-filters-actions-ctn {
        margin-top: 0.5rem;
        padding-top: 0.42rem;
        border-top: 1px solid var(--nf-border);
        display: flex;
        flex-wrap: wrap;
        gap: 0.42rem;
        justify-content: flex-end;
    }

    .fi-ta-filter-indicators {
        margin-top: 0.44rem;
        margin-bottom: 0.3rem;
        padding: 0.42rem 0.5rem;
        border-radius: 0.72rem;
        border: 1px dashed var(--nf-border-strong);
        background: rgba(26, 107, 78, 0.04);
    }

    .fi-ta-filter-indicators-label {
        color: var(--nf-text-soft);
        font-size: 0.76rem;
        font-weight: 700;
    }

    .fi-ta-filters-trigger-action-ctn .fi-btn {
        border-radius: 0.68rem !important;
    }

    html.dark .fi-ta-header,
    body.dark .fi-ta-header,
    [data-theme="dark"] .fi-ta-header,
    html.dark .fi-ta-header-toolbar,
    body.dark .fi-ta-header-toolbar,
    [data-theme="dark"] .fi-ta-header-toolbar {
        background:
            linear-gradient(180deg, rgba(18, 34, 26, 0.9), rgba(23, 42, 33, 0.95)),
            linear-gradient(90deg, rgba(60, 173, 130, 0.18), rgba(209, 169, 91, 0.12), transparent 78%);
    }

    html.dark .fi-ta-filter-indicators,
    body.dark .fi-ta-filter-indicators,
    [data-theme="dark"] .fi-ta-filter-indicators {
        background: rgba(60, 173, 130, 0.08);
    }

    .fi-btn {
        border-radius: 0.8rem !important;
        font-weight: 700;
        letter-spacing: 0.01em;
    }

    .fi-btn.fi-size-sm {
        min-height: 2rem;
        padding-inline: 0.72rem;
    }

    .fi-badge {
        border-radius: 999px !important;
        font-weight: 700;
    }

    .fi-input,
    .fi-select-input,
    .fi-textarea {
        border-radius: 0.75rem !important;
        border-color: var(--nf-border-strong) !important;
        background: var(--nf-surface) !important;
        color: var(--nf-text) !important;
    }

    .fi-input::placeholder,
    .fi-textarea::placeholder {
        color: var(--nf-text-muted) !important;
    }

    .fi-icon-btn {
        border-radius: 0.62rem !important;
        border: 1px solid var(--nf-border) !important;
        background: var(--nf-surface-soft) !important;
        color: var(--nf-primary-dark) !important;
        transition: all 0.15s ease;
    }

    .fi-icon-btn:hover {
        border-color: var(--nf-border-strong) !important;
        background: var(--nf-action-hover-bg) !important;
    }

    html.dark .fi-icon-btn,
    body.dark .fi-icon-btn,
    [data-theme="dark"] .fi-icon-btn {
        color: #d8ece0 !important;
    }

    html.dark .fi-wi-stats-overview-stat,
    body.dark .fi-wi-stats-overview-stat,
    [data-theme="dark"] .fi-wi-stats-overview-stat {
        background:
            radial-gradient(circle at 0% 0%, rgba(60, 173, 130, 0.2), transparent 40%),
            radial-gradient(circle at 100% 0%, rgba(209, 169, 91, 0.18), transparent 40%),
            linear-gradient(180deg, var(--nf-surface), var(--nf-surface-soft));
    }

    .fi-pagination .fi-pagination-item-button {
        border-radius: 0.68rem;
    }

    .nf-admin-banner {
        margin-bottom: 0.9rem;
        border-radius: 0.95rem;
        border: 1px solid var(--nf-banner-border);
        background: var(--nf-banner-bg);
        padding: 0.62rem 0.72rem;
        box-shadow: var(--nf-card-shadow-sm), var(--nf-card-shadow-lg);
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        justify-content: space-between;
    }

    .nf-admin-banner__chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.42rem;
        align-items: center;
    }

    .nf-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.32rem;
        border-radius: 999px;
        border: 1px solid var(--nf-chip-border);
        background: var(--nf-chip-bg);
        color: var(--nf-chip-text);
        font-size: 0.72rem;
        font-weight: 700;
        padding: 0.28rem 0.52rem;
        line-height: 1.15;
    }

    .nf-chip b {
        font-size: 0.78rem;
        font-weight: 800;
    }

    .nf-admin-banner__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }

    .nf-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.64rem;
        border: 1px solid var(--nf-action-border);
        background: var(--nf-action-bg);
        color: var(--nf-action-text);
        text-decoration: none;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 0.35rem 0.56rem;
        transition: all 0.15s ease;
        white-space: nowrap;
    }

    .nf-action:hover {
        background: var(--nf-action-hover-bg);
        border-color: rgba(26, 107, 78, 0.42);
    }

    .nf-action--primary {
        border-color: var(--nf-primary-dark);
        color: #ffffff;
        background: linear-gradient(90deg, var(--nf-primary), var(--nf-primary-dark));
    }

    .nf-action--primary:hover {
        color: #ffffff;
        background: linear-gradient(90deg, var(--nf-primary-dark), #0f4532);
    }

    @media (max-width: 760px) {
        .nf-admin-banner {
            padding: 0.55rem 0.62rem;
        }
    }
</style>
