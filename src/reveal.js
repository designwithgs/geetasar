/* गीतासार scroll reveal — 24 lines, no dependencies */
document.documentElement.classList.add('js');
function initReveal(){
  var els = document.querySelectorAll('.reveal:not(.in)');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)){
    els.forEach(function(el){ el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if (en.isIntersecting){
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  els.forEach(function(el){ io.observe(el); });
}
if (document.readyState !== 'loading') initReveal();
else document.addEventListener('DOMContentLoaded', initReveal);
window.initReveal = initReveal;
