/* Shared single-select UI. Native values/change events remain the business API. */
(() => {
  const widgets = new WeakMap(), disclosures = new WeakSet();
  const chevron='<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  let opened = null, serial = 0;
  const enabled = select => [...select.options].filter(option => !option.disabled && !option.parentElement.disabled);

  function enhance(root = document) {
    root.querySelectorAll('select:not([multiple]):not([data-native-select])').forEach(select => {
      if (widgets.has(select)) { widgets.get(select).refresh(); return; }
      const wrapper = document.createElement('div');
      wrapper.className = 'inline-select';
      select.before(wrapper);
      wrapper.append(select);
      select.hidden = true;
      select.tabIndex = -1;
      const key = select.id || 'inline-select-' + (++serial);
      const labelCopy=select.labels?.[0]?.cloneNode(true);
      labelCopy?.querySelectorAll('select,input,textarea,button,.required').forEach(el=>el.remove());
      const label = select.getAttribute('aria-label') || labelCopy?.textContent.trim() || '选择';
      const button = document.createElement('button');
      button.type = 'button';
      button.id = key + '-trigger';
      button.className = 'inline-select-trigger';
      button.setAttribute('role', 'combobox');
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-haspopup', 'listbox');
      button.setAttribute('aria-controls', key + '-options');
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = '<span class="inline-select-value"></span>'+chevron;
      const menu = document.createElement('div');
      menu.id = key + '-options';
      menu.className = 'inline-select-menu';
      menu.setAttribute('role', 'listbox');
      menu.setAttribute('aria-label', label);
      menu.hidden = true;
      wrapper.append(button, menu);
      let activeIndex = -1, search = '', searchAt = 0;

      function refresh() {
        const selected = select.selectedOptions[0];
        const value=selected?.textContent || label,disabled=select.matches(':disabled');
        const text=button.querySelector('.inline-select-value');
        if(text.textContent!==value)text.textContent=value;
        if(button.title!==value)button.title=value;
        if(button.disabled!==disabled)button.disabled=disabled;
        if (disabled && opened?.button === button) close();
      }
      function close(restoreFocus = false) {
        menu.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        button.removeAttribute('aria-activedescendant');
        if (opened?.button === button) opened = null;
        if (restoreFocus) button.focus();
      }
      function activate(index, scroll = true) {
        const options = enabled(select);
        if (!options.length) { activeIndex = -1; button.removeAttribute('aria-activedescendant'); return; }
        activeIndex = Math.max(0, Math.min(index, options.length - 1));
        menu.querySelectorAll('[role="option"]').forEach(el => el.classList.toggle('is-active', el.dataset.value === options[activeIndex].value));
        const active = [...menu.children].find(el => el.dataset.value === options[activeIndex].value);
        button.setAttribute('aria-activedescendant', active.id);
        if (scroll) active.scrollIntoView({block: 'nearest'});
      }
      function open() {
        if (select.matches(':disabled')) return;
        if (opened?.button !== button) opened?.close();
        menu.replaceChildren();
        [...select.options].forEach((option, index) => {
          const item = document.createElement('div');
          item.id = key + '-option-' + index;
          item.className = 'inline-select-option';
          item.setAttribute('role', 'option');
          item.setAttribute('aria-label', option.textContent);
          item.setAttribute('aria-selected', String(option.selected));
          const disabled = option.disabled || option.parentElement.disabled;
          item.setAttribute('aria-disabled', String(Boolean(disabled)));
          item.dataset.value = option.value;
          item.textContent = option.textContent;
          item.title = option.textContent;
          menu.append(item);
        });
        menu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        opened = {button, wrapper, menu, close};
        const rect = button.getBoundingClientRect();
        const below = window.innerHeight - rect.bottom - 14, above = rect.top - 14;
        const toBottom = below >= Math.min(220, above);
        menu.style.minWidth = Math.min(rect.width, window.innerWidth - 24) + 'px';
        menu.style.maxHeight = Math.max(48, Math.min(320, toBottom ? below : above)) + 'px';
        menu.style.left = '12px';
        menu.style.top = '0px';
        const size = menu.getBoundingClientRect();
        menu.style.left = Math.max(12, Math.min(rect.left, window.innerWidth - size.width - 12)) + 'px';
        menu.style.top = (toBottom ? rect.bottom + 6 : Math.max(8, rect.top - size.height - 6)) + 'px';
        activate(Math.max(0, enabled(select).findIndex(option => option.selected)));
      }
      function choose(value) {
        const option = enabled(select).find(option => option.value === value);
        if (!option) return;
        const scope=select.closest('dialog,main,header')||document.body;
        const index=[...scope.querySelectorAll('select:not([multiple]):not([data-native-select])')].indexOf(select);
        close();
        const changed = select.value !== option.value;
        select.value = option.value;
        refresh();
        if (changed) select.dispatchEvent(new Event('change', {bubbles: true}));
        // Forms and rule panels can replace unnamed selects during change.
        enhance(scope);
        const next=select.isConnected?select:scope.querySelectorAll('select:not([multiple]):not([data-native-select])')[index];
        widgets.get(next)?.button.focus();
      }
      button.addEventListener('click', () => menu.hidden ? open() : close());
      button.addEventListener('keydown', event => {
        const options = enabled(select), isOpen = !menu.hidden;
        if (event.key === 'Escape' && isOpen) { event.preventDefault(); event.stopPropagation(); close(true); return; }
        if (event.key === 'Tab') { close(); return; }
        if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
          event.preventDefault();
          if (!isOpen) open();
          if (event.key === 'Home') activate(0);
          else if (event.key === 'End') activate(options.length - 1);
          else if (isOpen) activate(activeIndex + (event.key === 'ArrowDown' ? 1 : -1));
          return;
        }
        if (['Enter',' '].includes(event.key)) {
          event.preventDefault();
          if (isOpen && options[activeIndex]) choose(options[activeIndex].value); else open();
          return;
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey && !event.isComposing) {
          event.preventDefault();
          const now = Date.now();
          search = (now - searchAt < 700 ? search : '') + event.key.toLocaleLowerCase();
          searchAt = now;
          if (!isOpen) open();
          const index = options.findIndex(option => option.textContent.toLocaleLowerCase().startsWith(search));
          if (index >= 0) activate(index);
        }
      });
      menu.addEventListener('pointerdown', event => { if (event.target.closest('[role="option"]')) event.preventDefault(); });
      menu.addEventListener('click', event => { const option = event.target.closest('[role="option"]'); if (option && option.getAttribute('aria-disabled') !== 'true') choose(option.dataset.value); });
      menu.addEventListener('pointermove', event => {
        const option = event.target.closest('[role="option"]');
        if (option && option.getAttribute('aria-disabled') !== 'true') activate(enabled(select).findIndex(item => item.value === option.dataset.value), false);
      });
      button.addEventListener('blur', () => close());
      select.addEventListener('change', refresh);
      widgets.set(select, {refresh,button});
      refresh();
    });
    root.querySelectorAll('details > summary').forEach(summary=>{
      if(disclosures.has(summary))return;
      disclosures.add(summary);summary.classList.add('inline-disclosure');
      const mark=document.createElement('span');mark.className='disclosure-chevron';mark.setAttribute('aria-hidden','true');mark.innerHTML=chevron;summary.append(mark);
    });
  }
  document.addEventListener('pointerdown', event => { if (opened && !opened.wrapper.contains(event.target)) opened.close(); }, true);
  document.addEventListener('scroll', event => { if (opened && !opened.menu.contains(event.target)) opened.close(); }, true);
  window.addEventListener('resize', () => opened?.close());
  window.LubanSelect = {enhance};
  enhance(document);
  new MutationObserver(()=>enhance(document.body)).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
})();
