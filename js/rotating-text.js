(function initRotatingText() {
    const el = document.getElementById('rotatingText');
    if (!el) return;

    const words = ['Solutions', 'Patterns', 'Systems', 'Problems'];
    const wordEl = el.querySelector('.rotating-word');
    let current = 0;

    function buildWord(word, initialState) {
        wordEl.innerHTML = '';
        const chars = [...word];
        // Stagger from last character — last char animates first (ReactBits staggerFrom="last")
        chars.forEach((ch, i) => {
            const span = document.createElement('span');
            span.className = `rotating-char ${initialState}`;
            span.textContent = ch === ' ' ? '\u00a0' : ch;
            const reverseIdx = chars.length - 1 - i;
            span.style.transitionDelay = `${reverseIdx * 0.025}s`;
            wordEl.appendChild(span);
        });
    }

    function showWord(word) {
        buildWord(word, 'state-below');
        // Double rAF ensures the browser has painted the initial state before transitioning
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                wordEl.querySelectorAll('.rotating-char').forEach(c => {
                    c.classList.remove('state-below');
                    c.classList.add('state-visible');
                });
            });
        });
    }

    function exitThen(cb) {
        wordEl.querySelectorAll('.rotating-char').forEach(c => {
            c.classList.remove('state-visible');
            c.classList.add('state-above');
        });
        // Wait for longest transition (last char has 0 delay, first has max stagger) + buffer
        setTimeout(cb, 500);
    }

    function rotate() {
        current = (current + 1) % words.length;
        exitThen(() => showWord(words[current]));
    }

    showWord(words[current]);
    setInterval(rotate, 2500);
})();
