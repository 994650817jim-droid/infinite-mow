import './gauntletCampaignPanel.css';

type Stat = readonly [label: string, value: string | number];
type Stage = { label: string; count: number; total: number };

export interface CampaignReport {
  theme: 'mortal' | 'ghost' | 'divine' | 'defeat';
  title: string;
  caption: string;
  subtitle: string;
  chapterArt: string;
  portrait?: string;
  stats: Stat[];
  stages?: Stage[];
  record?: string;
  reward?: { label: string; value?: string; coins?: number; scrolls?: number; observe?: (show:(value:string)=>void)=>()=>void };
  build?: { label: string; items: string[] }[];
  history?: () => Stat[];
  bosses?: { name: string; image?: string }[];
  party?: { name: string; portrait?: string; stats: Stat[]; stars: string }[];
  actions: { label: string; run: () => void }[];
}

export function campaignStages(cleared: number, size: number): Stage[] {
  let remaining = Math.max(0, cleared);
  return [{label:'凡将',total:10},{label:'鬼将',total:size},{label:'神将',total:size}].map(stage => {
    const count = Math.min(remaining, stage.total);
    remaining -= count;
    return {...stage,count};
  });
}

export function campaignHonour(size: number) { return size === 10 ? '三界无双' : '三界凯旋'; }

function append<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, content = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = content;
  node.className = className;
  parent.append(node);
  return node;
}

function portrait(parent: HTMLElement, url: string, className = '') {
  const image = append(parent, 'img', '', className);
  image.alt = '';
  image.src = url;
}

function figures(parent: HTMLElement, items: Stat[]) {
  const grid = append(parent, 'dl', '', 'report-figures');
  for (const [label, value] of items) {
    const item = append(grid, 'div');
    append(item, 'dt', label);
    append(item, 'dd', typeof value === 'number' ? value.toLocaleString('zh-CN') : value);
  }
}

export function campaignTrack(parent: HTMLElement, stages: Stage[]) {
  const track = append(parent, 'ol', '', 'report-stages');
  track.setAttribute('aria-label', '三关战绩');
  for (const stage of stages) {
    const item = append(track, 'li');
    item.classList.toggle('cleared', stage.count === stage.total);
    append(item, 'span', stage.label);
    append(item, 'b', stage.count + ' / ' + stage.total);
    const bar = append(item, 'progress');
    bar.max = stage.total; bar.value = stage.count;
    bar.setAttribute('aria-label', stage.label);
  }
}

function reportTabs(body: HTMLElement, data: CampaignReport) {
  const list = append(body, 'div', '', 'report-tabs');
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-label', '战报详情');
  const pages = [
    {label:'斩将名册', draw(panel: HTMLElement) {
      if (data.bosses?.length) {
        const roster = append(panel, 'ol', '', 'roster');
        for (const boss of data.bosses) {
          const item = append(roster, 'li');
          if (boss.image) portrait(item, boss.image);
          append(item, 'span', boss.name);
        }
      } else append(panel, 'p', '尚未击败名将', 'report-empty');
    }},
    {label:'本局构筑', draw(panel: HTMLElement) {
      for (const group of data.build ?? []) {
        const row = append(panel, 'section', '', 'report-build');
        append(row, 'h3', group.label);
        const items = append(row, 'ul');
        for (const item of group.items) append(items, 'li', item);
      }
      for (const member of data.party ?? []) {
        const row = append(panel, 'section', '', 'report-member');
        const name = append(row, 'h3');
        if (member.portrait) portrait(name, member.portrait);
        append(name, 'span', member.name);
        figures(row, member.stats);
        append(row, 'p', '将星 · ' + (member.stars || '尚未获得'));
      }
      if (!panel.children.length) append(panel, 'p', '本局尚未取得构筑', 'report-empty');
    }},
    {label:'历史战绩', draw(panel: HTMLElement) {
      const records = data.history?.() ?? [];
      if (records.length) figures(panel, records);
      else append(panel, 'p', '尚无记录', 'report-empty');
    }},
  ];
  const panel = append(body, 'div', '', 'report-page');
  panel.id = 'gauntlet-report-page';
  panel.tabIndex = 0;
  panel.setAttribute('role', 'tabpanel');
  const tabs = pages.map(({label}, i) => {
    const tab = append(list, 'button', label);
    tab.type = 'button'; tab.id = 'gauntlet-report-tab-' + i;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    tab.addEventListener('click', () => select(i));
    tab.addEventListener('keydown', event => {
      const target = {ArrowRight:(i+1)%pages.length,ArrowLeft:(i+pages.length-1)%pages.length,Home:0,End:pages.length-1}[event.key];
      if (target === undefined) return;
      event.preventDefault(); select(target); tabs[target].focus();
    });
    return tab;
  });
  function select(selected: number) {
    tabs.forEach((tab, i) => {
      tab.tabIndex = i === selected ? 0 : -1;
      tab.setAttribute('aria-selected', String(i === selected));
    });
    panel.setAttribute('aria-labelledby', tabs[selected].id);
    panel.replaceChildren();
    pages[selected].draw(panel);
  }
  select(0);
}

export function campaignHeader(header: HTMLElement, data: Pick<CampaignReport,'chapterArt'|'portrait'|'caption'|'title'|'subtitle'>, level:'h1'|'h2') {
  header.replaceChildren();
  header.style.setProperty('--chapter-art', 'url("' + data.chapterArt + '")');
  if (data.portrait) portrait(header, data.portrait, 'commander');
  append(header, 'div', data.caption, 'report-caption');
  const title = append(header, level, data.title);
  append(header, 'p', data.subtitle);
  return title;
}

export function campaignPanel(owner: Phaser.Scene, data: CampaignReport): () => void {
  const dialog = document.createElement('dialog');
  dialog.className = 'campaign-gate ' + data.theme;
  const sheet = append(dialog, 'article');
  const title = campaignHeader(append(sheet, 'header'), data, 'h2');
  title.id = 'gauntlet-dialog-heading';
  title.tabIndex = -1;
  title.autofocus = true;
  dialog.setAttribute('aria-labelledby', title.id);
  const body = append(sheet, 'section', '', 'report-body');
  if (data.stages?.length) campaignTrack(body, data.stages);
  figures(body, data.stats);
  if (data.record) append(body,'p',data.record,'report-record');
  let stopReward: (()=>void) | undefined;
  if (data.reward) {
    const reward = append(body, 'div', '', 'report-reward');
    append(reward, 'span', data.reward.label);
    if (data.reward.value !== undefined) {
      const value = append(reward, 'strong', data.reward.value);
      if (data.reward.observe) {
        value.setAttribute('aria-live','polite');
        stopReward = data.reward.observe(text => {value.textContent = text;});
      }
    } else {
      for (const [label,amount,icon] of [['钱币',data.reward.coins,'coins/coin_pile.png'],['残卷',data.reward.scrolls,'ui/codex/codex_scroll.png']] as const) {
        const asset = append(reward, 'strong');
        portrait(asset, 'assets/' + icon);
        append(asset, 'span', label);
        append(asset, 'b', '+' + (amount ?? 0).toLocaleString('zh-CN'));
      }
    }
  }
  if (data.bosses || data.build || data.party || data.history) reportTabs(body, data);
  const foot = append(sheet, 'footer');
  const priorInput = owner.input.enabled;
  owner.input.enabled = false;
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    stopReward?.();
    owner.input.enabled = priorInput;
    owner.events.off('shutdown', close);
    dialog.remove();
  }
  for (const action of data.actions) {
    const button = append(foot, 'button', action.label);
    button.type = 'button';
    button.addEventListener('click', () => {
      if (closed) return;
      close();
      action.run();
    });
  }
  dialog.addEventListener('cancel', event => event.preventDefault());
  for (const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','keydown','keyup']) {
    dialog.addEventListener(type, event => event.stopPropagation());
  }
  document.body.append(dialog);
  dialog.showModal();
  owner.events.once('shutdown', close);
  return close;
}
