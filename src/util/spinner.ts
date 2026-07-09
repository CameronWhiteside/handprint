// A tiny single-line stderr spinner. On a non-TTY (agents, CI, piped output) it
// degrades to plain lines so logs stay readable and never fill with \r noise.

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const CLEAR_LINE = '\r\x1b[2K';

export interface Spinner {
  /** Update the message shown next to the spinner (or print a line on non-TTY). */
  setText(text: string): void;
  /** Stop the animation; optionally print a final line. */
  stop(finalLine?: string): void;
}

export function createSpinner(initial: string, isTty: boolean = process.stderr.isTTY === true): Spinner {
  if (!isTty) {
    if (initial) process.stderr.write(`${initial}\n`);
    return {
      setText: (text) => {
        if (text) process.stderr.write(`${text}\n`);
      },
      stop: (finalLine) => {
        if (finalLine) process.stderr.write(`${finalLine}\n`);
      },
    };
  }

  let text = initial;
  let frame = 0;
  const render = (): void => {
    frame = (frame + 1) % FRAMES.length;
    process.stderr.write(`${CLEAR_LINE}${FRAMES[frame]} ${text}`);
  };
  render();
  const timer = setInterval(render, 80);
  timer.unref?.();

  return {
    setText: (next) => {
      text = next;
    },
    stop: (finalLine) => {
      clearInterval(timer);
      process.stderr.write(CLEAR_LINE);
      if (finalLine) process.stderr.write(`${finalLine}\n`);
    },
  };
}
