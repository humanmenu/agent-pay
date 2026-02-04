import readline from "readline";
export async function prompt(question, defaultValue) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const fullQuestion = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
    return new Promise((resolve) => {
        rl.question(fullQuestion, (answer) => {
            rl.close();
            const trimmed = answer.trim();
            resolve(trimmed || defaultValue || "");
        });
    });
}
export async function promptHidden(question) {
    if (!process.stdin.isTTY) {
        throw new Error("Hidden prompt requires a TTY");
    }
    return new Promise((resolve, reject) => {
        const stdin = process.stdin;
        const stdout = process.stdout;
        let input = "";
        const onData = (data) => {
            const char = data.toString("utf8");
            if (char === "\n" || char === "\r" || char === "\u0004") {
                stdout.write("\n");
                stdin.setRawMode(false);
                stdin.pause();
                stdin.removeListener("data", onData);
                resolve(input.trim());
            }
            else if (char === "\u0003") {
                stdout.write("\n");
                stdin.setRawMode(false);
                stdin.pause();
                stdin.removeListener("data", onData);
                reject(new Error("Interrupted"));
            }
            else if (char === "\u007f") {
                if (input.length > 0) {
                    input = input.slice(0, -1);
                    stdout.write("\b \b");
                }
            }
            else {
                input += char;
                stdout.write("*");
            }
        };
        stdout.write(question);
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on("data", onData);
    });
}
export async function promptYesNo(question, defaultNo = true) {
    const suffix = defaultNo ? "(y/N)" : "(Y/n)";
    const answer = (await prompt(`${question} ${suffix}`)).toLowerCase();
    if (!answer)
        return !defaultNo;
    return answer === "y" || answer === "yes";
}
export async function promptSelect(question, options, defaultIndex = 0) {
    console.log(question);
    options.forEach((option, index) => {
        console.log(`  ${index + 1}) ${option}`);
    });
    const choice = await prompt("Select option", String(defaultIndex + 1));
    const index = Number(choice) - 1;
    if (Number.isNaN(index) || index < 0 || index >= options.length) {
        return defaultIndex;
    }
    return index;
}
