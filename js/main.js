/* ---- Parallax ---- */
const heroCamel = document.getElementById('heroCamel');

function onScroll() {
    const y = window.scrollY;
    if (heroCamel) heroCamel.style.transform = `translateY(${y * 0.2}px)`;
}
window.addEventListener('scroll', onScroll, { passive: true });

/* ---- Scroll-reveal ---- */
const revealSections = document.querySelectorAll('.section');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('visible');
            observer.unobserve(e.target);
        }
    });
}, { threshold: 0.1 });
revealSections.forEach(s => observer.observe(s));

/* ---- Expandable experience cards ---- */
function toggleExp(header) {
    const body   = header.nextElementSibling;
    const toggle = header.querySelector('.exp-toggle');
    const isOpen = body.classList.contains('open');
    body.classList.toggle('open');
    toggle.textContent = isOpen ? '+ Details' : '\u2014 Close';
}

/* ---- Contact dropdown ---- */
document.getElementById('contactBtn').addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('contactDropdown').classList.toggle('show');
});
window.addEventListener('click', function() {
    document.getElementById('contactDropdown').classList.remove('show');
});
document.getElementById('contactDropdown').addEventListener('click', e => e.stopPropagation());

/* ---- Copy email ---- */
function copyEmail(e) {
    e.stopPropagation();
    navigator.clipboard.writeText('camdenelwell@gmail.com');
    const btn = e.currentTarget;
    const msg = document.getElementById('copyMsg');
    btn.textContent = '\u2705';
    msg.classList.add('show');
    setTimeout(() => { btn.textContent = '\uD83D\uDCCB'; msg.classList.remove('show'); }, 2000);
}
