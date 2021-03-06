<template>
    <section
        v-scrollable
        ref="debugPage"
        class="debug-page"
        tabindex="0"
        @keypress="focusInput"
        @mouseup="focusInputUnlessTextIsSelected"
    >
        <div class="console">
            <div class="output">
                <div class="info">
                    Hello, welcome to the Zcoin Client debug console. Here you can interact with zcoind directly. Write
                    <span class="bold">help</span> and see the list of commands, or <span class="bold">clear</span> to
                    clear the console.
                </div>

                <div
                    v-for="{input, output} of sessionLog"
                >
                    <div class="input-line">
                        <div class="prompt">
                            >
                        </div>

                        <div class="input">
                            {{ input }}
                        </div>
                    </div>

                    <div class="output">{{ output }}</div>
                </div>
            </div>

            <div class="input-line current-input-line">
                <div class="prompt">
                    >
                </div>

                <div
                    ref="currentInput"
                    class="input"
                    contenteditable="true"
                    @keydown="onInput"
                    @keyup="updateSuggestions"
                >
                </div>
            </div>

            <div class="suggestions">
                <span
                    v-for="suggestion of suggestions"
                    :key="suggestion"
                    class="suggestion"
                    :class="{selected: suggestions[suggestionTabIndex] === suggestion}"
                >
                    {{ suggestion }}
                </span>
            </div>
        </div>
    </section>
</template>

<script>
export default {
    name: "DebugPage",

    data () {
        return {
            // This is the transcript of our console session that will be shown to the user. Unlike this.history, it
            // will be cleared if the user clears the console.
            //
            // {input: string, output: string}[]
            sessionLog: [],

            // This is a history of entered commands. It will not be erased when the user clears the console.
            history: [],

            // On start or immediately after the user has entered a command, historyIndex will be set to 0 and will
            // refer to temporaryBuffer. The user may use the up or down arrows on their keyboard to increase or
            // decrease historyIndex respectively. Navigating to a non-zero historyIndex will cause the corresponding
            // entry (counted backwards from 1) of this.history to be loaded into currentInput. Edits made by the user
            // to currentInput will not be saved back into this.history.
            historyIndex: 0,

            // temporaryBuffer is a temporary input buffer referenced by historyIndex 0. Unlike other items in history,
            // edits made to it will be persistent when navigating away from and back to it, however it will be cleared
            // when a command is sent (even if it is not sent while historyIndex 0 is active.
            temporaryBuffer: '',

            // A list of all available commands. Will be filled in when mounted.
            availableCommands: [],

            // The list of suggestions relevant to the current input.
            suggestions: [],

            // Which suggestion is currently active. This is -1 before the user tabs to the next suggestion.
            suggestionTabIndex: -1,

            // Extra help to display to the user in addition to RPC help.
            clientHelp: {
                clear: {
                    shortHelp: 'clear',
                    longHelp: 'clear the console'
                },

                chdatadir: {
                    shortHelp: 'chdatadir /path/to/datadir',
                    longHelp: 'Change the datadir to be passed to zcoind on next startup WITHOUT moving any data, creating the directory if it does not exist.'
                }
            }
        }
    },

    mounted () {
        this.focusInput();

        // Get the list of available commands.
        this.$daemon.legacyRpcCommands().then(commands => {
            this.availableCommands = commands.concat(Object.keys(this.clientHelp));
        })
    },

    methods: {
        // Update the suggestions to show the user. This can't be made as a computed property because this.$refs is not
        // reactive.
        updateSuggestions (event=null) {
            if (event && event.keyCode === 9) {
                return;
            }

            this.suggestionTabIndex = -1;

            const input = this.$refs.currentInput && this.$refs.currentInput.innerText;
            if (input) {
                this.suggestions = this.availableCommands.filter(cmd => cmd.indexOf(input) === 0);
            } else {
                // Don't show completions if the user hasn't typed anything yet.
                this.suggestions = [];
            }

            // Make sure suggestions are visible.
            this.$nextTick(() =>
                this.scrollToBottom()
            );
        },

        // Move the user to the next suggestion.
        onTab () {
            if (!this.suggestions.length) {
                return;
            }

            this.suggestionTabIndex = (this.suggestionTabIndex + 1) % this.suggestions.length;
            this.$refs.currentInput.innerText = this.suggestions[this.suggestionTabIndex];

            this.$nextTick(() =>
                this.moveCursorToEndOfInput()
            );
        },

        // Clear the input.
        onCtrlC () {
            this.historyIndex = 0;
            this.temporaryBuffer = '';
            this.$refs.currentInput.innerText = '';
            this.updateSuggestions();

            this.$nextTick(() =>
                this.scrollToBottom()
            );
        },

        focusInputUnlessTextIsSelected() {
            // FIXME: We will fail to fire if the current click is one that removes a selection.
            if (!document.getSelection().toString()) {
                this.focusInput();
            }
        },

        focusInput() {
            this.$refs.currentInput.focus();
        },

        scrollToBottom() {
            this.$refs.debugPage.scrollTop = this.$refs.debugPage.scrollHeight;
            this.$refs.debugPage.scrollLeft = 0;
        },

        moveCursorToEndOfInput() {
            this.focusInput();
            // select all the content in the element
            document.execCommand('selectAll', false, null);
            // collapse selection to the end
            document.getSelection().collapseToEnd();
        },

        onInput(event) {
            switch (event.keyCode) {
            case 9:
                event.preventDefault();
                this.onTab();
                break;

            case 38:
                event.preventDefault();
                this.onUpArrow();
                break;

            case 40:
                event.preventDefault();
                this.onDownArrow();
                break;

            case 13:
                event.preventDefault();
                this.onEnter();
                break;

            case 67:
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.onCtrlC();
                }

                break
            }
        },

        onUpArrow() {
            if (this.historyIndex === 0) {
                this.temporaryBuffer = this.$refs.currentInput.innerText;
            }

            if (this.history.length < this.historyIndex + 1) {
                // The user is trying to move upwards in history when they're already at the beginning.
                return;
            }

            this.historyIndex += 1;
            this.$refs.currentInput.innerText = this.history[this.history.length -  this.historyIndex];

            this.$nextTick(() => this.moveCursorToEndOfInput());
        },

        onDownArrow() {
            if (this.historyIndex ===  0) {
                // The user is trying to move downwards in history when they're already at the end.
                return;
            }

            this.historyIndex -= 1;

            if (this.historyIndex === 0) {
                this.$refs.currentInput.innerText = this.temporaryBuffer;
            } else {
                this.$refs.currentInput.innerText = this.history[this.history.length - this.historyIndex];
            }

            this.$nextTick(() => this.moveCursorToEndOfInput());
        },

        async onEnter() {
            let input = this.$refs.currentInput.innerText;

            // For some reason I'm not exactly sure of, spaces in the input are sometimes non-breaking (\xa0) instead of
            // breaking (\x20).
            input = input.replace(/\xa0/g, ' ');

            // Prevent the user from making changes to the command or hitting enter again while we're loading the result
            // of a command.
            this.$refs.currentInput.contentEditable = false;

            this.history.push(input);

            let m;

            if (input === 'clear') {
                this.sessionLog = [];
            } else if (input.match(/^\s*chdatadir/)) {
                if ((m = input.match(/^\s*chdatadir (.+)$/))) {
                    this.sessionLog.push({
                        input,
                        output: await this.chdatadir(m[1])
                    });
                } else {
                    const c = this.clientHelp['chdatadir'];
                    this.sessionLog.push({
                        input,
                        output: `${c.shortHelp}\n${c.longHelp}`
                    });
                }
            } else if (input.match(/^\s*help\s*$/)) { // Add our own commands to help.
                let output = await this.legacyRpc("help");
                output += "\n\n== GUI ==\n";
                output += Object.values(this.clientHelp)
                    .map(c => c.shortHelp)
                    .sort()
                    .join("\n");

                this.sessionLog.push({
                    input,
                    output
                });
            } else if ((m = input.match(/^\s*help\s*(\w+)\s*$/)) && this.clientHelp[m[1]]) { // Give help about our own commands.
                this.sessionLog.push({
                    input,
                    output: this.clientHelp[m[1]].longHelp,
                })
            } else {
                this.sessionLog.push({
                    input,
                    output: await this.legacyRpc(input)
                });
            }

            this.$refs.currentInput.contentEditable = true;
            this.$refs.currentInput.innerText = '';
            this.temporaryBuffer = '';

            this.$nextTick(() => {
                this.focusInput();
                this.updateSuggestions();
            });
        },

        async chdatadir(newDataDirectory) {
            try {
                await this.$store.dispatch('App/changeBlockchainLocation', newDataDirectory);
            } catch(e) {
                return `Error: ${e}`;
            }

            return "Success! Changes will take effect on restart. Please note that if you wish to keep your existing data, you must migrate it yourself.";
        },

        async legacyRpc(commandline) {
            const response = await this.$daemon.legacyRpc(commandline);

            if (response.result) {
                return response.result;
            } else if (response.error) {
                return response.error.message;
            } else if (!response.id) {
                return '';
            } else {
                return response;
            }
        }
    }
}
</script>

<style scoped lang="scss">
.debug-page {
    // override styles defined globally
    padding-right: 0;

    word-break: break-all;

    background-color: $color--dark;
    color: $color--green;

    .console {
        font: {
            family: monospace;
            size: 1.3em;
        }

        padding: {
            top: 4em;
            left: 2%;
            right: 2%;
        }

        .input-line {
            font-weight: bold;

            .prompt, .input {
                display: inline;
            }

            .input {
                margin-left: 0.5em;
                max-width: border-box;
            }
        }

        .output {
            .info {
                font-style: italic;
                margin-bottom: 2em;

                word-break: normal;

                .bold {
                    font-weight: bold;
                }
            }

            .input {
                font-weight: bold;
            }

            .output {
                white-space: pre-line;
                margin-bottom: 1em;
            }
        }

        .current-input-line {
            .prompt {
                user-select: none;
            }

            .input {
                outline: none;
            }
        }

        .suggestions {
            margin-top: 0.5em;

            .suggestion {
                &.selected {
                    font-weight: bold;
                }
            }
        }
    }
}
</style>