import json, os, re, shutil, subprocess, sys
from collections import defaultdict
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
REPO_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))

def load_configs():
    with open(CONFIG_PATH, "r", encoding="utf-8-sig") as f:
        j_cfg = json.load(f)
    t_path = os.path.abspath(os.path.join(BASE_DIR, j_cfg["git_tracker_config"]))
    with open(t_path, "r", encoding="utf-8-sig") as f:
        t_cfg = json.load(f)
    return j_cfg, t_cfg

def run_git(args):
    r = subprocess.run(["git", "-C", REPO_ROOT] + args, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode, r.stdout.strip()

def resolve_tracker_key(display_name, j_cfg):
    for tracker_key, disp in j_cfg.get("display_names", {}).items():
        if disp == display_name:
            return tracker_key
    return display_name

def detect_active_contributor(j_cfg, t_cfg):
    _, local_email = run_git(["config", "--local", "user.email"])
    _, local_name = run_git(["config", "--local", "user.name"])
    if not local_email:
        _, local_email = run_git(["config", "user.email"])
    if not local_name:
        _, local_name = run_git(["config", "user.name"])
    email_low = local_email.strip().lower()
    name_low = local_name.strip().lower()
    display_map = j_cfg.get("display_names", {})
    for canonical, info in t_cfg["members"].items():
        disp = display_map.get(canonical, canonical)
        if email_low in [e.lower() for e in info.get("emails", [])]:
            return disp, local_email or local_name
        if name_low in [a.lower() for a in info.get("aliases", [])] or name_low == disp.lower():
            return disp, local_email or local_name
    return None, f"{local_name} <{local_email}>".strip()

def select_contributor(j_cfg, t_cfg):
    members = list(j_cfg["member_folders"].keys())
    detected, raw_id = detect_active_contributor(j_cfg, t_cfg)
    if detected:
        print(f"\n[AUTO-DETECTED] Active Git contributor: {detected} ({raw_id})")
        ans = input("Continue as this member? [Y/n]: ").strip().lower()
        if ans in ("", "y", "yes"):
            return detected
    else:
        print(f"\n[INFO] Found Git identity ({raw_id or 'not set'}).")
    print("\nSelect Team Member:")
    for idx, m in enumerate(members, 1):
        print(f"  {idx}. {m}")
    while True:
        choice = input("Enter number (1 or 2): ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(members):
            return members[int(choice) - 1]
        print("Invalid selection. Please enter 1 or 2.")

def get_valid_date(deadline_str):
    today_str = datetime.now().strftime("%Y-%m-%d")
    print(f"\nCurrent Date: {today_str} (Submission Deadline: {deadline_str})")
    raw = input(f"Press Enter for today ({today_str}), or enter a past date (YYYY-MM-DD): ").strip()
    target_str = raw if raw else today_str
    while True:
        try:
            dt = datetime.strptime(target_str, "%Y-%m-%d").date()
            today_dt = datetime.now().date()
            if dt > today_dt:
                print("[ERROR] Future dates are not allowed. Enter today or a past date.")
            else:
                return target_str, (dt < today_dt)
        except ValueError:
            print("[ERROR] Invalid format. Use YYYY-MM-DD (e.g., 2026-11-21).")
        target_str = input("Enter date (YYYY-MM-DD): ").strip()

def fetch_commits_for_member_date(display_name, target_date, j_cfg, t_cfg):
    tracker_key = resolve_tracker_key(display_name, j_cfg)
    info = t_cfg["members"][tracker_key]
    emails = [e.lower() for e in info.get("emails", [])]
    aliases = [a.lower() for a in info.get("aliases", [])] + [display_name.lower()]
    bots = [b.lower() for b in t_cfg.get("ignore_bots", [])]
    code, out = run_git(["log", "--all", "--date=short", f"--since={target_date} 00:00:00", f"--until={target_date} 23:59:59", "--format=%H|%h|%an|%ae|%ad|%P|%s"])
    if code != 0 or not out:
        return []
    seen, matched = set(), []
    for line in out.splitlines():
        parts = line.split("|", 6)
        if len(parts) < 7:
            continue
        full_h, short_h, an, ae, ad, parents, subj = parts
        if full_h in seen or ad != target_date:
            continue
        seen.add(full_h)
        if any(b in an.lower() or b in ae.lower() for b in bots):
            continue
        if ae.strip().lower() in emails or an.strip().lower() in aliases:
            matched.append({"hash": short_h, "message": subj.strip(), "is_merge": len(parents.strip().split()) > 1})
    matched.reverse()
    return matched

def prompt_multiline(label, allow_empty=False):
    print(f"\n{label}\n  (Enter one item per line. Press Enter on an empty line when finished):")
    items = []
    while True:
        line = input("  - ").strip()
        if not line:
            if items or allow_empty:
                break
            print("  Please enter at least one item.")
            continue
        items.append(line)
    return items

def format_entry_markdown(entry):
    retro_badge = f" `[RETROSPECTIVE ENTRY - Logged on {entry['logged_on']}]`" if entry["is_retrospective"] else ""
    lines = [
        f"## {entry['date']}{retro_badge}",
        f"- **Contributor:** {entry['member']}",
        f"- **Today's Objective:** {entry['objective']}",
        "- **Completed Tasks:**",
    ] + [f"  - {t}" for t in entry["completed"]]
    lines.append("- **Pending Tasks:**")
    lines.extend([f"  - {p}" for p in entry["pending"]] if entry["pending"] else ["  - None"])
    lines.append("- **Encountered Problems:**")
    lines.extend([f"  - {pr}" for pr in entry["problems"]] if entry["problems"] else ["  - None"])
    lines.append("- **Problem Resolutions:**")
    lines.extend([f"  - {r}" for r in entry["resolutions"]] if entry["resolutions"] else ["  - N/A"])
    lines.append("- **Linked Git Commits:**")
    if entry["commits"]:
        for c in entry["commits"]:
            m_tag = " *(PR Merge)*" if c["is_merge"] else ""
            lines.append(f"  - `{c['hash']}` — {c['message']}{m_tag}")
    else:
        lines.append("  - *No Git commits recorded on this date (non-coding / planning / documentation / research work).*")
    lines.append("- **Next Day's Plan:**")
    lines.extend([f"  - {np}" for np in entry["next_plan"]])
    lines.append("\n---\n")
    return "\n".join(lines)

def parse_monthly_entries(filepath):
    if not os.path.exists(filepath):
        return "", {}
    with open(filepath, "r", encoding="utf-8-sig") as f:
        content = f.read()
    parts = re.split(r"(?=^## \d{4}-\d{2}-\d{2})", content, flags=re.MULTILINE)
    header = parts[0].strip() + "\n\n"
    entries_by_date = {}
    for block in parts[1:]:
        m = re.match(r"^## (\d{4}-\d{2}-\d{2})", block)
        if m:
            entries_by_date[m.group(1)] = block.strip() + "\n\n"
    return header, entries_by_date

def write_monthly_entries(filepath, default_title, entries_by_date):
    header, _ = parse_monthly_entries(filepath)
    if not header.strip():
        header = f"# {default_title}\n\n"
    body = "".join(entries_by_date[d] for d in sorted(entries_by_date.keys()))
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(header + body)

def rebuild_rollups(journal_root, j_cfg):
    all_entries = []
    for member_name, folder_name in j_cfg["member_folders"].items():
        member_dir = os.path.join(journal_root, folder_name)
        if not os.path.isdir(member_dir):
            continue
        for fname in sorted(os.listdir(member_dir)):
            if not re.match(r"^\d{4}-\d{2}\.md$", fname):
                continue
            _, entries_map = parse_monthly_entries(os.path.join(member_dir, fname))
            for d_str, block in entries_map.items():
                all_entries.append((d_str, member_name, block))
    all_entries.sort(key=lambda x: (x[0], x[1]))
    combined_path = os.path.join(journal_root, "combined_journal.md")
    with open(combined_path, "w", encoding="utf-8") as f:
        f.write("# SafeConnect Capstone - Combined Team Development Journal\n\n")
        f.write(f"*Auto-compiled from individual member logs. Total Logged Entries: {len(all_entries)}*\n\n---\n\n")
        for d_str, member_name, block in all_entries:
            f.write(re.sub(r"^## (\d{4}-\d{2}-\d{2})(.*)$", rf"## \1 - {member_name}\2", block, count=1, flags=re.MULTILINE))
    weekly_groups = defaultdict(list)
    for d_str, member_name, block in all_entries:
        dt = datetime.strptime(d_str, "%Y-%m-%d").date()
        weekly_groups[dt.isocalendar()[:2]].append((d_str, member_name, block))
    weekly_path = os.path.join(journal_root, "weekly_summary.md")
    with open(weekly_path, "w", encoding="utf-8") as f:
        f.write("# SafeConnect Capstone - Weekly Progress Summary\n\n*Auto-generated weekly aggregation.*\n\n")
        if not weekly_groups:
            f.write("_No journal entries logged yet._\n")
            return
        for (yr, wk) in sorted(weekly_groups.keys()):
            items = weekly_groups[(yr, wk)]
            dates = [x[0] for x in items]
            f.write(f"## {yr} - Week {wk:02d} ({min(dates)} to {max(dates)})\n\n- **Total Journal Entries:** {len(items)}\n")
            m_cnt, c_cnt = defaultdict(int), defaultdict(int)
            for d_str, m_name, blk in items:
                m_cnt[m_name] += 1
                c_cnt[m_name] += len(re.findall(r"^\s+- `[0-9a-f]{6,}`", blk, flags=re.MULTILINE))
            for m_name in j_cfg["member_folders"].keys():
                f.write(f"- **{m_name}:** {m_cnt[m_name]} logged day(s), {c_cnt[m_name]} linked commit(s)\n")
            f.write("\n### Highlights & Daily Objectives\n\n")
            for d_str, m_name, blk in items:
                obj_m = re.search(r"- \*\*Today's Objective:\*\* (.+)", blk)
                f.write(f"- **{d_str} ({m_name}):** {obj_m.group(1).strip() if obj_m else 'N/A'}\n")
            f.write("\n---\n\n")

def run_interactive(journal_root, j_cfg, t_cfg):
    print("=" * 60 + "\n  SafeConnect Capstone - Daily Development Journal Generator\n" + "=" * 60)
    member = select_contributor(j_cfg, t_cfg)
    target_date, is_retro = get_valid_date(j_cfg["submission_deadline"])
    month_str = target_date[:7]
    monthly_file = os.path.join(journal_root, j_cfg["member_folders"][member], f"{month_str}.md")
    os.makedirs(os.path.dirname(monthly_file), exist_ok=True)
    _, existing = parse_monthly_entries(monthly_file)
    if target_date in existing:
        if input(f"\n[DUPLICATE] Entry exists for {target_date}. Overwrite? [y/N]: ").strip().lower() not in ("y", "yes"):
            return
    commits = fetch_commits_for_member_date(member, target_date, j_cfg, t_cfg)
    print(f"\n[GIT LOOKUP] Found {len(commits)} commit(s) for {member} on {target_date}:")
    for c in commits:
        print(f"  - {c['hash']}: {c['message']}")
    obj = ""
    while not obj:
        obj = input("\n1. Today's Objective: ").strip()
    entry = {
        "date": target_date, "logged_on": datetime.now().strftime("%Y-%m-%d"), "is_retrospective": is_retro,
        "member": member, "objective": obj, "completed": prompt_multiline("2. Completed Tasks:"),
        "pending": prompt_multiline("3. Pending Tasks (Enter to skip):", True),
        "problems": prompt_multiline("4. Encountered Problems (Enter to skip):", True),
        "resolutions": prompt_multiline("5. Problem Resolutions (Enter to skip):", True),
        "commits": commits, "next_plan": prompt_multiline("6. Next Day's Plan:"),
    }
    existing[target_date] = format_entry_markdown(entry)
    title = f"Development Journal - {member} ({datetime.strptime(target_date, '%Y-%m-%d').strftime('%B %Y')})"
    write_monthly_entries(monthly_file, title, existing)
    rebuild_rollups(journal_root, j_cfg)
    print(f"\n[SAVED] Updated {monthly_file}, combined_journal.md, and weekly_summary.md")

def run_sandbox_test(j_cfg, t_cfg):
    sb = os.path.join(BASE_DIR, ".test_sandbox")
    shutil.rmtree(sb, ignore_errors=True)
    os.makedirs(sb, exist_ok=True)
    try:
        today_str = datetime.now().strftime("%Y-%m-%d")
        samples = [
            {"date": today_str, "logged_on": today_str, "is_retrospective": False, "member": "Israt Jerin Nafisa",
             "objective": "Configure automated Git tracker and daily journal generator",
             "completed": ["Built interactive Daily Development Journal Generator CLI"], "pending": [],
             "problems": [], "resolutions": [], "commits": fetch_commits_for_member_date("Israt Jerin Nafisa", today_str, j_cfg, t_cfg),
             "next_plan": ["Continue Capstone backend integration"]},
            {"date": "2026-11-19", "logged_on": today_str, "is_retrospective": True, "member": "Tasmin Jahan Toshi",
             "objective": "Review emergency SOS UI wireframes", "completed": ["Reviewed wireframes with team"],
             "pending": [], "problems": [], "resolutions": [], "commits": [], "next_plan": ["Implement frontend validation"]}
        ]
        for s in samples:
            mf = os.path.join(sb, j_cfg["member_folders"][s["member"]], f"{s['date'][:7]}.md")
            os.makedirs(os.path.dirname(mf), exist_ok=True)
            _, ent = parse_monthly_entries(mf)
            ent[s["date"]] = format_entry_markdown(s)
            write_monthly_entries(mf, f"Development Journal - {s['member']}", ent)
        rebuild_rollups(sb, j_cfg)
        print("\n--- SAMPLE: weekly_summary.md ---\n" + open(os.path.join(sb, "weekly_summary.md"), encoding="utf-8").read())
        print("[TEST PASSED] Sandbox test succeeded with zero impact on real journal/ files.")
    finally:
        shutil.rmtree(sb, ignore_errors=True)


def get_recent_commit_dates(display_name, j_cfg, t_cfg, days=7):
    tracker_key = resolve_tracker_key(display_name, j_cfg)
    info = t_cfg["members"][tracker_key]
    emails = [e.lower() for e in info.get("emails", [])]
    aliases = [a.lower() for a in info.get("aliases", [])] + [display_name.lower()]
    bots = [b.lower() for b in t_cfg.get("ignore_bots", [])]
    code, out = run_git(["log", "--all", "--date=short", f"--since={days} days ago", "--format=%ad|%an|%ae"])
    if code != 0 or not out:
        return []
    dates = set()
    for line in out.splitlines():
        parts = line.split("|", 2)
        if len(parts) < 3:
            continue
        ad, an, ae = parts
        if any(b in an.lower() or b in ae.lower() for b in bots):
            continue
        if ae.strip().lower() in emails or an.strip().lower() in aliases:
            dates.add(ad.strip())
    return sorted(dates)

def run_auto_catchup(journal_root, j_cfg, t_cfg):
    run_git(["fetch", "--all", "--quiet"])
    active_member, _ = detect_active_contributor(j_cfg, t_cfg)
    today_str = datetime.now().strftime("%Y-%m-%d")
    logged_any, needs_manual_today = False, False
    for member in j_cfg["member_folders"].keys():
        candidate_dates = sorted(set(get_recent_commit_dates(member, j_cfg, t_cfg, 30) + [today_str]))
        for d_str in candidate_dates:
            mf = os.path.join(journal_root, j_cfg["member_folders"][member], f"{d_str[:7]}.md")
            os.makedirs(os.path.dirname(mf), exist_ok=True)
            _, existing = parse_monthly_entries(mf)
            if d_str in existing:
                continue
            commits = fetch_commits_for_member_date(member, d_str, j_cfg, t_cfg)
            if not commits:
                if d_str == today_str and member == active_member:
                    needs_manual_today = True
                continue
            clean_msgs = [re.sub(r"^(feat|fix|docs|chore|refactor|style|test)(\([^)]+\))?:\s*", "", c["message"], flags=re.I) for c in commits]
            entry = {
                "date": d_str, "logged_on": today_str, "is_retrospective": (d_str < today_str), "member": member,
                "objective": clean_msgs[0][:1].upper() + clean_msgs[0][1:],
                "completed": [m[:1].upper() + m[1:] for m in clean_msgs],
                "pending": [], "problems": [], "resolutions": [], "commits": commits,
                "next_plan": ["Continue next planned module and review progress"]
            }
            existing[d_str] = format_entry_markdown(entry)
            title = f"Development Journal - {member} ({datetime.strptime(d_str, '%Y-%m-%d').strftime('%B %Y')})"
            write_monthly_entries(mf, title, existing)
            logged_any = True
            print(f"[AUTO-LOGGED] {member} -> {d_str} ({len(commits)} commits)")
    if logged_any:
        rebuild_rollups(journal_root, j_cfg)
    if needs_manual_today:
        sys.exit(3)

if __name__ == "__main__":
    j_cfg, t_cfg = load_configs()
    j_root = os.path.abspath(os.path.join(BASE_DIR, j_cfg["journal_root"]))
    if "--test" in sys.argv:
        run_sandbox_test(j_cfg, t_cfg)
    elif "--auto" in sys.argv:
        run_auto_catchup(j_root, j_cfg, t_cfg)
    else:
        run_interactive(j_root, j_cfg, t_cfg)
