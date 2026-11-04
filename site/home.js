// 폰 줄마다 좌우 화살표를 단다. 끝에 닿은 쪽 화살표는 흐려져서 남은 사진이 어느 쪽에 있는지 보인다.
(function () {
  var PREV = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>';
  var NEXT = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>';
  /** 끝으로 칠 오차. 스크롤 위치가 소수점으로 남아 끝에서도 1~2px 모자랄 때가 있다. */
  var EDGE = 4;

  function arrow(className, label, icon, railId) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'arrow ' + className;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-controls', railId);
    button.innerHTML = icon;
    return button;
  }

  document.querySelectorAll('.carousel').forEach(function (carousel) {
    var rail = carousel.querySelector('.rail');
    if (!rail) return;
    var prev = arrow('arrow-prev', '이전 화면 보기', PREV, rail.id);
    var next = arrow('arrow-next', '다음 화면 보기', NEXT, rail.id);
    carousel.appendChild(prev);
    carousel.appendChild(next);

    function update() {
      var max = rail.scrollWidth - rail.clientWidth;
      carousel.classList.toggle('is-scrollable', max > EDGE);
      prev.disabled = rail.scrollLeft <= EDGE;
      next.disabled = rail.scrollLeft >= max - EDGE;
    }

    function step(direction) {
      rail.scrollBy({ left: direction * rail.clientWidth * 0.8, behavior: 'smooth' });
    }

    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });
    rail.addEventListener('scroll', update, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(update).observe(rail);
    window.addEventListener('resize', update);
    update();
  });
})();
