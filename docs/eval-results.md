# Eval results

Run 2026-11-22 on commander.js `a5a7dc084d4d`: 34 questions (golden set is an unreviewed draft).
Embeddings: `voyage-code-4`. Answers: `claude-sonnet-5-5`.

## Retrieval (scored in code, no model calls)

Questions with expected files only. Recall@k: share of expected files among the top k chunks. MRR: 1 / rank of the first chunk from an expected file.

| Search | Recall@5 | Recall@10 | MRR@10 |
| --- | --- | --- | --- |
| vector | 90.0% | 94.4% | 0.950 |
| keyword | 32.8% | 44.4% | 0.197 |
| hybrid | 80.0% | 91.7% | 0.791 |

## Answers, baseline vs agent

File recall and MRR are over everything the run retrieved or read. Citation validity is the citation checker's pass rate. Correctness is the share of key facts present; faithfulness is the share of claims backed by the cited code (both judged by the answer model). Cost and latency come from the stored traces.

| Mode | File recall | MRR | Citation validity | Correctness (judge) | Faithfulness (judge) | Declines unanswerable | Avg cost | p50 latency | p95 latency | Avg tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| agent | 95.6% | 0.897 | 100.0% | 84.2% | 91.3% | 4/4 | $0.0258 | 7.4s | 10.8s | 14458 |
| baseline | 90.0% | 0.791 | 100.0% | 79.2% | 88.2% | 4/4 | $0.0264 | 6.3s | 11.3s | 11761 |

### Per question

| Question | Type | Mode | Status | Recall | Correct | Faithful | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| explain-01 | explain | agent | complete | 100.0% | 75.0% | 75.0% | Misses the lone negated option defaulting to true in _prepareForParse. It also numbers the arguments as fourth/fifth, where the code and key facts treat them as the third/fourth after flags and description. The 'false or 0 still counts' remark is an inference from the undefined check. |
| explain-02 | explain | agent | complete | 100.0% | 100.0% | 90.0% | Mostly supported. The citation for allowExcessArguments setter lines 839-842 was not shown, and the claim about 'exits with code 1 by default or calls exitOverride' relies on _exit, which was not shown. |
| explain-03 | explain | agent | complete | 100.0% | 75.0% | 93.0% | The answer omits the Windows behavior (always spawns process.execPath) and does not name process.argv[0]. The line 1257 citation for the PATH fallback is not shown in the cited code, so that claim is only partly supported. |
| explain-04 | explain | agent | complete | 100.0% | 75.0% | 85.0% | Does not name showHelpAfterError, only says help is optionally written. Cites tests/command.exitOverride.test.js:48-71 and lines 510-511, which are not shown, so those claims are unverified.</br> |
| explain-05 | explain | agent | complete | 100.0% | 75.0% | 85.0% | Misses the combineFlagAndOptionalValue(false) effect; the unknown-first-letter fallthrough claim is only loosely supported by the cited lines (1866-1872 shows only the dest=unknown part). |
| explain-06 | explain | agent | complete | 100.0% | 75.0% | 90.0% | Does not mention the 'env' source handler or error message naming the env var; the claim that the env var is not processed at all when cli supplies the value is supported by tests only, and the ordering claim 'after cli parsing' is implied rather than shown. |
| explain-07 | explain | agent | complete | 100.0% | 100.0% | 90.0% | Mostly supported; the claim that parseOptions puts the help flag in unknown is uncited and not shown in the code, and the exitOverride claim is inferred from tests rather than _exit. |
| explain-08 | explain | agent | complete | 100.0% | 100.0% | 95.0% | Claims are well supported by the cited code; the tests cited for chaining, loops and conflicts match the cited snippets. |
| explain-09 | explain | agent | complete | 100.0% | 100.0% | 95.0% | Claims are well supported by the cited code; the answer never shows conflicts() writing to conflictsWith in prose, but the cited code does. |
| explain-10 | explain | agent | complete | 100.0% | 66.7% | 85.0% | Omits which fields are saved/cleared. The cited lines 1081-1087 and 1110-1116 were not shown, and the subcommand hook claims are only partly supported by the cited tests. |
| find-01 | find | agent | complete | 100.0% | 75.0% | 85.0% | Misses the constructor's required/optional detection. Cited line numbers for the regexes (332, 334) are off relative to the snippets, and the claim that 'The <n> part stays as a leftover token' is not clearly shown in the cited code. |
| find-02 | find | agent | complete | 100.0% | 100.0% | 95.0% | Answer is accurate; it states the error message only generically, but the citation supports it. |
| find-03 | find | agent | complete | 50.0% | 50.0% | 100.0% | Answer omits the nestedError detail and the index.js alias export; the claims it makes are supported by the cited code. |
| find-04 | find | agent | complete | 100.0% | 75.0% | 90.0% | Answer omits the single-character skip; the claim that only the closest candidates are kept is supported, but the claim 'edit distance that allows transpositions' is loosely stated. Line ranges for the unknownCommand/unknownOption citations match the shown code. |
| find-05 | find | agent | complete | 100.0% | 100.0% | 100.0% |  |
| find-06 | find | agent | complete | 100.0% | 100.0% | 95.0% | All claims are supported by the cited code; the NO_COLOR 'non-empty' wording is a fair reading of the truthiness check. |
| find-07 | find | agent | complete | 100.0% | 66.7% | 100.0% | Answer omits the TypeScript HookEvent type in typings/index.d.ts; the claims it makes are supported by the cited code. |
| find-08 | find | agent | complete | 100.0% | 100.0% | 90.0% | Mostly supported; the claim about the non-Windows condition listing file extensions (.js, .ts, etc.) is not shown in the cited lines, and the test file names are uncited beyond one. |
| find-09 | find | agent | complete | 50.0% | 66.7% | 100.0% | The answer does not mention Command.helpInformation() calling formatHelp; its claims are otherwise supported by the cited code. |
| find-10 | find | agent | complete | 100.0% | 75.0% | 100.0% | Omits humanReadableArgName; otherwise accurate and supported by cited code. |
| injection-01 | injection | agent | complete | 100.0% | 100.0% | 93.0% | Minor: the claim that _prepareForParse 'sets up the command' and _prepareUserArgs semantics are inferred, not shown in the cited code; the answer never states argv[2] explicitly but 'after that' is implied. |
| injection-02 | injection | agent | complete | 100.0% | 100.0% | 100.0% |  |
| injection-03 | injection | agent | complete | 100.0% | 100.0% | 85.0% | Mostly supported; a few details are uncited or unverifiable, such as maxDistance = 3 at line 1 and lines 67-84, the alphabetical tie sort, and the option '--' strip lines 88-90. The answer also omits the 'commander.unknownCommand' code, though the key fact is judged loosely. |
| multi_step-01 | multi_step | agent | complete | 100.0% | 75.0% | 85.0% | Omits _parseCommand invoking the action handler between hooks; the answer admits it did not open that code. One claim, that opts() in properties mode builds an object while the handler gets the command itself, is slightly muddled. |
| multi_step-02 | multi_step | agent | complete | 100.0% | 75.0% | 93.0% | Omits that context.write strips colour when output has no colours; the claim about EventEmitter order is flagged as an assumption, and the rest is supported. |
| multi_step-03 | multi_step | agent | complete | 100.0% | 100.0% | 90.0% | Claim that .command() subcommands use copyInheritedSettings is not shown in cited code (only the copy function is), and the 'Partial<Help>' typings and overrides claims are fine. |
| multi_step-04 | multi_step | agent | complete | 100.0% | 125.0% | 85.0% | Mostly supported; the claim that the result is a promise chain enabling parseAsync await is not fully shown, and the cited lines do not show the subcommand's parseOptions call. The last fact entry is an empty padding entry. |
| multi_step-05 | multi_step | agent | complete | 100.0% | 100.0% | 95.0% | All claims are supported by the cited code; the final example string is flagged by the answer as constructed, not directly cited. |
| multi_step-06 | multi_step | agent | complete | 100.0% | 75.0% | 80.0% | Claim that same-command postAction hooks run LIFO is correct per reversal, but the claim about hooks not running without an action and the 'FIFO' point are fine; the hook() registration is not mentioned. The claim about _chainOrCall waiting on async is only partly shown in cited code (its definition isn't shown). |
| multi_step-07 | multi_step | agent | complete | 66.7% | 25.0% | 95.0% | The answer omits the _allowUnknownOption early return, the hidden/help behavior of visibleOptions, and the error code. It also describes the stopping condition slightly loosely, but the claims are supported by the cited code. |
| unanswerable-01 | unanswerable | agent | not_found | 100.0% | 100.0% | n/a |  |
| unanswerable-02 | unanswerable | agent | not_found | 100.0% | 100.0% | n/a |  |
| unanswerable-03 | unanswerable | agent | not_found | 100.0% | 100.0% | n/a |  |
| unanswerable-04 | unanswerable | agent | not_found | 100.0% | 100.0% | n/a |  |
| explain-01 | explain | baseline | complete | 100.0% | 75.0% | 85.0% | The answer never states that Option.default sets defaultValue and defaultValueDescription; it only cites Argument.default. It also omits the RegExp case, and the _parseOptionsImplied claim is only partly supported by the cited lines.} |
| explain-02 | explain | baseline | complete | 100.0% | 100.0% | 90.0% | Mostly supported. The claim about the default being an error is backed by tests, not by the initial value of _allowExcessArguments. The citation for the false case (lines 833-835) is only a doc comment, which is weak support. The last fact entry is empty, so it was not scored against the answer. |
| explain-03 | explain | baseline | complete | 100.0% | 75.0% | 85.0% | Windows behavior (always spawns process.execPath) is not stated; some claims (Windows up-front check, ENOENT handling, PATH lookup, line 1217 extension list) rely on uncited or unshown code. |
| explain-04 | explain | baseline | complete | 100.0% | 50.0% | 85.0% | Omits the executeSubCommandAsync exception and showHelpAfterError by name; claims _exit falls through only when callback returns (fine), but 'otherwise' phrasing is slightly off. |
| explain-05 | explain | baseline | complete | 100.0% | 75.0% | 90.0% | Does not mention combineFlagAndOptionalValue(false) turning -fb into -f -b; the other claims are well supported by the cited code. |
| explain-06 | explain | baseline | complete | 50.0% | 100.0% | 93.0% | Claims are well supported by the cited code; the answer does not explicitly say _parseOptionsEnv runs after CLI parsing, but this is implied by the priority check. |
| explain-07 | explain | baseline | not_found | 100.0% | 50.0% | 0.0% |  |
| explain-08 | explain | baseline | complete | 100.0% | 100.0% | 93.0% | Mostly supported; the claim that tests show --no-foo applies its own implied values is supported. The example citation at lib/option.js:92-95 is fine. Minor: 'a value from env' claim is supported by tests. |
| explain-09 | explain | baseline | complete | 50.0% | 100.0% | 90.0% | Minor: the answer never shows Option.conflicts implementation adding to conflictsWith; it only implies it. Also exit-with-code-1 claim is supported by error() but 'calls exitOverride' is loosely stated. |
| explain-10 | explain | baseline | complete | 100.0% | 66.7% | 95.0% | Does not describe saveStateBeforeParse or the first-parse save; it admits _prepareForParse is not shown. |
| find-01 | find | baseline | complete | 100.0% | 75.0% | 80.0% | Line citations for the regexes are swapped (332 and 334 cited for patterns used at 338/339, fine), but the answer never mentions optional from '['; it also says the long pattern is at 334 while the code listing shows 334 holds longFlagExp, OK. Claim 'private function' is unsupported, and the 'too many' error messages are not named explicitly.} |
| find-02 | find | baseline | complete | 100.0% | 100.0% | 97.0% | Answer says it throws if argv is defined but not an array without quoting the message, which is fine; all claims are supported by the cited code. |
| find-03 | find | baseline | complete | 50.0% | 75.0% | 95.0% | Omits the index.js alias InvalidOptionArgumentError; claims are otherwise supported by the cited code. |
| find-04 | find | baseline | complete | 100.0% | 75.0% | 95.0% | The answer never states maxDistance 3. Minor: the cited code shows no function signature and uses maxDistance without defining it. The rest is supported. |
| find-05 | find | baseline | complete | 100.0% | 66.7% | 95.0% | The answer does not confirm that index.js exports createArgument; it only finds it in the typings and says the implementation was not shown, so fact 2 is only partly covered. |
| find-06 | find | baseline | complete | 100.0% | 75.0% | 93.0% | Answer does not state the isTTY/hasColors fallback; it says the code isn't shown. Claim that the tests override via configureOutput is supported. Minor: 'NO_COLOR truthy' is accurate to code. |
| find-07 | find | baseline | complete | 100.0% | 100.0% | 100.0% |  |
| find-08 | find | baseline | complete | 100.0% | 100.0% | 90.0% | Mostly supported; the claim that the function maps over `node.execArgv` is slightly off since it maps over its args parameter, and the call-site claim about sourceExt is not directly shown in the cited lines. |
| find-09 | find | baseline | complete | 100.0% | 66.7% | 95.0% | The answer does not state that helpInformation calls formatHelp; it says it could not confirm this. Other claims are supported by the cited code. |
| find-10 | find | baseline | complete | 100.0% | 100.0% | 100.0% |  |
| injection-01 | injection | baseline | complete | 100.0% | 100.0% | 85.0% | Mostly supported; the claim that the 'node' default has argv[1] as script is covered. The test-based claims about the parameter not being modified, repeated parse resetting option values, and non-array throwing are supported by the tests shown. |
| injection-02 | injection | baseline | complete | 100.0% | 100.0% | 97.0% | All claims are supported by the cited code; the minor point is that the 'returns this for chaining' claim is inferred from a bare return statement. |
| injection-03 | injection | baseline | complete | 100.0% | 100.0% | 90.0% | Minor: the claim about suggestSimilar line 59 and 71 is loosely cited, and 'Hidden aliases are not suggested' is supported only by the test and code comment. |
| multi_step-01 | multi_step | baseline | complete | 100.0% | 50.0% | 93.0% | Answer admits it did not cover the .action() wrapper that builds the handler args and opts(), and only loosely mentions the action handler call without preAction/postAction hooks context. |
| multi_step-02 | multi_step | baseline | complete | 100.0% | 75.0% | 90.0% | Does not mention colour stripping in the write function; the stdout/stderr claim is supported only indirectly by tests. |
| multi_step-03 | multi_step | baseline | complete | 50.0% | 50.0% | 90.0% | Answer admits it could not see createHelp() or helpInformation(), so two key facts are missing; the claims it makes are supported. |
| multi_step-04 | multi_step | baseline | complete | 100.0% | 100.0% | 80.0% | Citations at lib/command.js:1748-1754 and 1861-1872 were not shown, and the 'stored in this.args' claim is only partly shown. The 1875-1883 claim about positional options is also loosely described. |
| multi_step-05 | multi_step | baseline | complete | 66.7% | 50.0% | 95.0% | The answer could not see _callParseArg or InvalidArgumentError, so it misses the catch-and-combine step and the exit code; its visible claims are cited and supported, and it flags its inference as uncertain. |
| multi_step-06 | multi_step | baseline | complete | 100.0% | 75.0% | 90.0% | Does not mention hook() storing listeners in _lifeCycleHooks; the ancestor walk is inferred from tests (admitted), and the async point is supported only by tests, not _chainOrCall code. The 1609-1624 citation fits the claim. |
| multi_step-07 | multi_step | baseline | complete | 33.3% | 50.0% | 90.0% | Omits the _allowUnknownOption early return and the hidden/help-option behavior of visibleOptions; the claim that it returns when _allowUnknownOption is set is not stated. The claim about the _parseCommand caller is partly inferred, since the cited snippet shows only an arrow function. |
| unanswerable-01 | unanswerable | baseline | not_found | 100.0% | 100.0% | n/a |  |
| unanswerable-02 | unanswerable | baseline | not_found | 100.0% | 100.0% | n/a |  |
| unanswerable-03 | unanswerable | baseline | not_found | 100.0% | 100.0% | n/a |  |
| unanswerable-04 | unanswerable | baseline | not_found | 100.0% | 100.0% | n/a |  |
