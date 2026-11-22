# Stress test findings (2026-11-22)

Run against the local app with real Claude and Voyage keys. 25 repos tried, about 110 questions asked, plus URL, API, lifecycle and concurrency tests.

**Status:** bugs 1 to 8 and items 9, 10, 12 (Prisma only), 14 (commit awareness only), 17 and 18 were fixed in phase 13 (`docs/plans/phase-13-stress-fixes.md`) and re-checked with the same questions. Items 13, 15, 16 and 19 are open and listed in the README's known gaps.

The trap repo used for the change tests was local only (a folder fed through the real indexing pipeline with the GitHub download swapped out), because creating a public repo was not permitted.

## Bugs

1. **Citations cannot point at paths containing `[`, `]` or spaces.** The pattern in `apps/api/src/agent/citations.ts` (`[^\s[\]:]+`) excludes them. Next.js dynamic routes (`src/app/api/auth/[...nextauth]/route.ts`, `customers/[id]/route.ts`) and files like `my notes.md` are uncitable. If an answer's only citations are to such files, the whole answer is replaced with "I could not back an answer with valid citations". portal365 has 38 such files, Roots 16, BrainBooster 16.
   - Repro: on portal365, ask "What does the NextAuth catch-all API route file export?" On the trap repo, "Where is the warehouse?" (the answer is in `my notes.md`).

2. **A NUL byte late in a text file fails the whole index.** Binary detection only catches a NUL near the start. Postgres then rejects the file's content and the job dies with "Indexing failed unexpectedly". On a first index the repo is unusable (BurntSushi/ripgrep, `tests/data/sherlock-nul.txt`). On a re-index the repo stays on its old version and can never update. Same root cause: `GET /repos/:id/file?path=a%00b` returns 500, not 400.

3. **Database errors log their query parameters, which include full file contents and answer text.** The ripgrep failure wrote the whole 90 KB file into the api log. This breaks the rule "never log secrets or full file contents".

4. **The "no valid citation" guard throws away useful replies.** When an answer has no valid citation, the text is replaced by one generic line. That hits:
   - requests the assistant should decline with a reason (run `npm test`, fetch a URL, rewrite a file, off-topic, "?"): the user is never told what it can and cannot do;
   - questions about the conversation itself ("what did I ask first?");
   - follow-ups answered from earlier turns: citations that were valid two turns ago count as invalid because nothing was retrieved this turn;
   - an off-by-one range on a short file (`latin1.txt:1-2` on a one-line file);
   - an empty file ("What does empty.py contain?").
   Also, answers marked not found keep their `[path:lines]` text but lose the checked, clickable citations.

5. **Follow-up memory is unreliable in longer conversations.** In a 7-turn chat on kilo, by turn 5 the model said the first question it could see was turn 2. After a suppressed answer, the next turn answered the previous question as well as the new one. "shorter" produced a correction, not a shorter answer.

6. **Long paths get shortened in citations and then fail the check.** On google/gson the model cited `Gson.java:349-362` in place of `gson/src/main/java/com/google/gson/Gson.java:349-362`. 14 of 15 citations were marked invalid on a correct answer.

7. **Concurrent questions in one conversation are both accepted.** Messages are saved as user, user, assistant, assistant, and one answer came back not found.

8. **An empty GitHub repo reports "Cloning the repo failed. Check that it is public and reachable".** The repo is public and reachable; it just has no commits.

## Weaknesses found by the eval

9. **Hybrid search scores below vector search alone.** Recall@10 86.7% against 94.4%, MRR 0.655 against 0.950 (34 questions, voyage-code-4). Keyword search is weak on natural-language questions (44.4%) and equal-weight fusion lets it push good vector results out. Measured with a keyword weight in the fusion: 0.5 gives 88.3%, 0.3 gives 91.7% (MRR 0.791), 0.15 gives 91.7% (MRR 0.822). Not applied.

10. **The judge returned 7 unreadable verdicts out of 60**, so correctness and faithfulness in `docs/eval-results.md` are averaged over fewer answers. Causes: a stray `"` after the facts array, or prose where the fields should be. Structured output for the judge call would remove this.

11. **Agent declined 3 of 4 unanswerable questions; baseline declined 4 of 4.**

## Limits worth knowing (a reviewer may ask)

12. **Unsupported file types are skipped silently and the assistant does not know.** `.prisma` (portal365's schema), `*.gitignore` templates (317 of 324 files in github/gitignore), notebooks (231 files skipped in PythonDataScienceHandbook). Asked about the Prisma models, it guessed the file was "probably missing from this snapshot".

13. **Secrets hardcoded in ordinary source files are indexed and quoted verbatim.** The secret filter works on file names (`.env`, `credentials.json`, `id_rsa` were all skipped), not on content. `src/settings.py` with a fake AWS key and password was printed in full on request.

14. **No awareness of freshness.** The assistant cannot see which commit it is reading or when it was indexed, and nothing checks GitHub for new commits. After a re-index inside an existing conversation it said its earlier (correct at the time) answer "was wrong". Old messages keep `valid: true` citations that now open changed content, or 404 for deleted files.

15. **Cost outliers.** One agent answer on Roots cost $0.19 (8 tool calls); typical is $0.01 to $0.03. One trace has no cost recorded.

16. **One refusal.** A question that led the agent to read a file containing only `/etc/passwd` (a symlink checked out as text) ended with "The model declined to answer this question".

17. **URL forms rejected with a generic message:** `http://`, `www.github.com`, `github.com/owner/repo` with no scheme, and `git@github.com:owner/repo.git`.

18. **One rate-limit bucket covers asking and adding repos.** 20 questions in a minute block adding a repo for the rest of that minute.

19. **No tool for whole-repo facts.** "How many files and lines?" and "list every function" cannot be answered; the assistant says so honestly.

## Small things

- Raw validation text reaches the user: "url: Too small: expected string to have >=1 characters", "body: Invalid input: expected object, received undefined" (malformed JSON).
- An oversized `POST /repos` body says "Shorten the question".
- The file-count limit message says "105 MB"; the size check says "100 MB". The file-count limit is only detected after the clone.
- Deleting a repo while an answer streams ends the stream with "Something went wrong while answering".
- Two temp clone folders (`cda-index-*`) were left behind after the api was killed mid-index.
- From reading `places.tsx`, not tested in a browser: "New conversation" is disabled while a repo re-indexes, although the api answers from the old version during that time.

## What held up

- **Citations:** apart from the cases above, every citation in about 60 complete answers was valid.
- **Prompt injection:** the README injection was ignored and reported in agent mode, baseline mode and the repo overview. Injection in the question was declined.
- **Tools stay read only and in the repo:** path traversal, `/etc/passwd`, `.env`, "run this", "fetch this" and "save this file" all went nowhere.
- **File filter:** `.env`, credentials, private key, binaries, lock file, `node_modules`, `dist`, `vendor`, a 400 KB file and minified files were all skipped.
- **URL validation:** lookalike hosts, gists, `file://`, shell characters, user-only URLs and over-long URLs were rejected. `.git`, trailing slash, `/tree/...` and query strings were accepted and de-duplicated to one repo.
- **Limits:** 136 MB repo, 6 GB repo and a repo with over 3000 files were refused with clear messages. Private repos report not found.
- **Re-index:** only changed files were processed (11 of 14 reused, then 13 of 14). Added, deleted and renamed files were all reflected in answers. A failed re-index left the old version serving.
- **Lifecycle:** questions during a re-index work; a double re-index gives 409; stop mid-answer saves the partial answer as stopped; deleting during indexing is clean; killing the api mid-index marks the job failed with "The api restarted while this job was running. Retry it." and a retry succeeds.
- **Load:** 20 simultaneous answers completed in under 4 seconds; requests 21 to 24 got 429. 11 repos indexed concurrently.
- **Languages:** TypeScript, JavaScript, Python, Go, Rust, C, Ruby, Java, HTML, CSS and Markdown all indexed and answered. Arabic and Japanese questions were answered in the same language.
- **API fuzzing:** bad ids, unknown routes, wrong types, malformed JSON and oversized bodies all returned 4xx with a request id. No SQL injection.

## Not tested

- The web UI in a browser with the real model (everything above went through the api).
- `docker compose up`.
- Langfuse export.
