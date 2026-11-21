import csv
import json
import os
import subprocess
import sys
from collections import defaultdict
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
REPO_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def resolve_contributor(author_name, author_email, commit_msg, config):
    # বট বাদ দেওয়া
    for bot in config.get("ignore_bots", []):
        if bot.lower() in author_name.lower() or bot.lower() in author_email.lower():
            return None

    # ১. যদি একই পিসিতে কাজ করার সময় কমিট মেসেজে [Toshi] বা [Jerin] ট্যাগ দেওয়া থাকে
    msg_lower = commit_msg.lower()
    for canonical_name, info in config["members"].items():
        tag = info.get("tag", "").lower()
        if tag and tag in msg_lower:
            return canonical_name

    # ২. ইমেইল এবং নাম (Alias) অনুযায়ী আসল টিম মেম্বার শনাক্ত করা
    email_clean = author_email.strip().lower()
    name_clean = author_name.strip().lower()

    for canonical_name, info in config["members"].items():
        if email_clean in [e.lower() for e in info.get("emails", [])]:
            return canonical_name
        if name_clean in [a.lower() for a in info.get("aliases", [])]:
            return canonical_name

    return f"Unmapped ({author_name})"


def run_git_log(start_date="", end_date=""):
    # সব ব্রাঞ্চ ও বর্তমান HEAD থেকে ইউনিক কমিট হিস্ট্রি পড়া (ডুপ্লিকেট এড়াতে --all ব্যবহার করা হয়েছে)
    cmd = [
        "git",
        "-C",
        REPO_ROOT,
        "log",
        "--all",
        "--date=short",
        "--numstat",
        "--format=COMMIT_START|%H|%h|%an|%ae|%ad|%P|%s",
    ]
    if start_date:
        cmd.append(f"--since={start_date}")
    if end_date:
        cmd.append(f"--until={end_date} 23:59:59")

    result = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8-sig", errors="replace"
    )
    if result.returncode != 0:
        print("Git Error:", result.stderr)
        sys.exit(1)
    return result.stdout


def parse_commits(raw_output, config):
    seen_hashes = set()
    commits = []
    current = None

    for line in raw_output.splitlines():
        if line.startswith("COMMIT_START|"):
            if current:
                commits.append(current)
            parts = line.split("|", 7)
            _, full_hash, short_hash, an, ae, ad, parents, subject = parts

            # ডুপ্লিকেট কমিট হ্যাশ প্রতিরোধ
            if full_hash in seen_hashes:
                current = None
                continue
            seen_hashes.add(full_hash)

            member = resolve_contributor(an, ae, subject, config)
            if member is None:
                current = None
                continue

            is_merge = len(parents.strip().split()) > 1
            current = {
                "full_hash": full_hash,
                "short_hash": short_hash,
                "raw_author": an,
                "email": ae,
                "member": member,
                "date": ad,
                "is_merge": is_merge,
                "message": subject.strip(),
                "files_changed": 0,
                "insertions": 0,
                "deletions": 0,
            }
        elif current and "\t" in line:
            # Merge commit-এর লাইন সংখ্যা যেন ডুপ্লিকেট না হয়, তাই non-merge কমিটের লাইন গণনা করা হয়
            if not current["is_merge"]:
                stat_parts = line.split("\t")
                if len(stat_parts) == 3:
                    ins, dels, _ = stat_parts
                    current["files_changed"] += 1
                    if ins.isdigit():
                        current["insertions"] += int(ins)
                    if dels.isdigit():
                        current["deletions"] += int(dels)

    if current:
        commits.append(current)

    return commits


def generate_reports(commits, config):
    os.makedirs(REPORTS_DIR, exist_ok=True)

    member_stats = defaultdict(
        lambda: {
            "total_commits": 0,
            "direct_commits": 0,
            "merge_commits": 0,
            "files_changed": 0,
            "insertions": 0,
            "deletions": 0,
            "active_days": set(),
            "first_commit": "9999-99-99",
            "last_commit": "0000-00-00",
        }
    )

    daily_stats = defaultdict(
        lambda: {
            "commits": 0,
            "merge_commits": 0,
            "files_changed": 0,
            "insertions": 0,
            "deletions": 0,
            "messages": [],
        }
    )

    for c in commits:
        m = c["member"]
        d = c["date"]

        member_stats[m]["total_commits"] += 1
        if c["is_merge"]:
            member_stats[m]["merge_commits"] += 1
        else:
            member_stats[m]["direct_commits"] += 1

        member_stats[m]["files_changed"] += c["files_changed"]
        member_stats[m]["insertions"] += c["insertions"]
        member_stats[m]["deletions"] += c["deletions"]
        member_stats[m]["active_days"].add(d)
        if d < member_stats[m]["first_commit"]:
            member_stats[m]["first_commit"] = d
        if d > member_stats[m]["last_commit"]:
            member_stats[m]["last_commit"] = d

        daily_stats[(d, m)]["commits"] += 1
        if c["is_merge"]:
            daily_stats[(d, m)]["merge_commits"] += 1
        daily_stats[(d, m)]["files_changed"] += c["files_changed"]
        daily_stats[(d, m)]["insertions"] += c["insertions"]
        daily_stats[(d, m)]["deletions"] += c["deletions"]
        daily_stats[(d, m)]["messages"].append(f"[{c['short_hash']}] {c['message']}")

    # ১. member_summary.csv তৈরি করা
    member_csv_path = os.path.join(REPORTS_DIR, "member_summary.csv")
    with open(member_csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Contributor Name",
            "Total Commits",
            "Direct Work Commits",
            "PR Merge Commits",
            "Active Days",
            "Files Changed",
            "Insertions (+)",
            "Deletions (-)",
            "Net Line Change",
            "First Active Date",
            "Last Active Date",
        ])
        for member, s in sorted(member_stats.items(), key=lambda x: x[1]["total_commits"], reverse=True):
            writer.writerow([
                member,
                s["total_commits"],
                s["direct_commits"],
                s["merge_commits"],
                len(s["active_days"]),
                s["files_changed"],
                s["insertions"],
                s["deletions"],
                s["insertions"] - s["deletions"],
                s["first_commit"],
                s["last_commit"],
            ])

    # ২. daily_activity.csv তৈরি করা
    daily_csv_path = os.path.join(REPORTS_DIR, "daily_activity.csv")
    with open(daily_csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Date",
            "Contributor Name",
            "Commits",
            "Merge Commits",
            "Files Changed",
            "Insertions (+)",
            "Deletions (-)",
            "Commit Summaries",
        ])
        for (date_str, member), s in sorted(daily_stats.items(), reverse=True):
            writer.writerow([
                date_str,
                member,
                s["commits"],
                s["merge_commits"],
                s["files_changed"],
                s["insertions"],
                s["deletions"],
                " ; ".join(s["messages"]),
            ])

    # ৩. contribution_report.md তৈরি করা
    md_path = os.path.join(REPORTS_DIR, "contribution_report.md")
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(md_path, "w", encoding="utf-8-sig") as f:
        f.write(f"# {config.get('project_name', 'Capstone Project')} - Git Contribution Report\n\n")
        f.write(f"- **Report Generated On:** {now_str}\n")
        f.write(f"- **Final Submission Target Date:** {config.get('submission_deadline', '2026-12-09')}\n")
        f.write(f"- **Total Verified Unique Commits Analyzed:** {len(commits)}\n\n")

        f.write("## 1. Team Member Contribution Summary\n\n")
        f.write("| Contributor | Total Commits | Direct Commits | Merge Commits | Active Days | Files Changed | Insertions (+) | Deletions (-) |\n")
        f.write("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n")
        for member, s in sorted(member_stats.items(), key=lambda x: x[1]["total_commits"], reverse=True):
            f.write(
                f"| **{member}** | {s['total_commits']} | {s['direct_commits']} | {s['merge_commits']} | "
                f"{len(s['active_days'])} | {s['files_changed']} | +{s['insertions']} | -{s['deletions']} |\n"
            )

        f.write("\n## 2. Evaluation Note: Commits vs. Lines Changed vs. Real Contribution\n\n")
        f.write("> **Academic Integrity & Evaluation Guideline:**\n")
        f.write("> - **Commit Count** reflects save frequency and workflow habits, not feature difficulty.\n")
        f.write("> - **Lines Changed (Insertions/Deletions)** can be inflated by auto-generated files, datasets, formatting, or refactoring. Merge commits are excluded from line counts here to prevent double-counting teammate code.\n")
        f.write("> - **Actual Contribution** includes system architecture, debugging, research, UI/UX design, testing, and documentation—which are best evaluated alongside the commit messages below.\n\n")

        f.write("## 3. Daily Activity Summary\n\n")
        f.write("| Date | Contributor | Commits | Files Changed | Lines (+/-) | Work Highlights |\n")
        f.write("| :--- | :--- | :---: | :---: | :---: | :--- |\n")
        for (date_str, member), s in sorted(daily_stats.items(), reverse=True):
            highlights = "; ".join(s["messages"][:3])
            if len(s["messages"]) > 3:
                highlights += f" (+{len(s['messages']) - 3} more)"
            highlights = highlights.replace("|", "\\|")
            f.write(
                f"| {date_str} | {member} | {s['commits']} | {s['files_changed']} | "
                f"+{s['insertions']} / -{s['deletions']} | {highlights} |\n"
            )

        f.write("\n## 4. Complete Chronological Commit Log\n\n")
        f.write("| Date | Hash | Contributor | Type | Files | +/- | Commit Message |\n")
        f.write("| :--- | :--- | :--- | :---: | :---: | :---: | :--- |\n")
        for c in commits:
            ctype = "Merge" if c["is_merge"] else "Direct"
            msg = c["message"].replace("|", "\\|")
            f.write(
                f"| {c['date']} | `{c['short_hash']}` | {c['member']} | {ctype} | "
                f"{c['files_changed']} | +{c['insertions']}/-{c['deletions']} | {msg} |\n"
            )

    print(f"[SUCCESS] Reports generated successfully in: {REPORTS_DIR}")
    print(f" -> Total unique commits processed: {len(commits)}")


if __name__ == "__main__":
    cfg = load_config()
    # কমান্ড লাইন থেকে কাস্টম তারিখ দেওয়া হলে সেটি নেবে, নাহলে config.json বা পুরো ইতিহাস নেবে
    s_date = sys.argv[1] if len(sys.argv) > 1 else cfg.get("start_date", "")
    e_date = sys.argv[2] if len(sys.argv) > 2 else cfg.get("end_date", "")

    raw = run_git_log(s_date, e_date)
    parsed = parse_commits(raw, cfg)
    generate_reports(parsed, cfg)


