// Visual-only enhancements for the concept design. Does not touch form logic (script.js owns that).

// Scroll-reveal
const revealEls = document.querySelectorAll(".reveal");
if (revealEls.length) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  revealEls.forEach((el) => io.observe(el));
}

// Sticky "Register" CTA — appears once the hero has scrolled out of view,
// hides again once the register form itself (or anything after it) is on
// screen so it doesn't float on top of the form/contact section.
const stickyCta = document.getElementById("sticky-cta");
const heroEl = document.querySelector(".hero");
const registerEl = document.getElementById("register");
if (stickyCta && heroEl && registerEl) {
  let heroVisible = true;
  let registerVisible = false;
  const updateStickyCta = () => stickyCta.classList.toggle("show", !heroVisible && !registerVisible);

  new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; updateStickyCta(); }, { threshold: 0 }).observe(heroEl);
  new IntersectionObserver(([entry]) => { registerVisible = entry.isIntersecting; updateStickyCta(); }, { threshold: 0 }).observe(registerEl);
}
