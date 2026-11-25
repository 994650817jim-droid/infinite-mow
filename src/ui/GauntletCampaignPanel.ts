import './gauntletCampaignPanel.css';

type Stat = readonly [label: string, value: string | number];
export interface CampaignReport {
  theme: 'mortal' | 'ghost' | 'divine' | 'defeat';
  title: string;
  caption: string;
  subtitle: string;
  chapterArt: string;
  portrait?: string;
  stats: Stat[];
  stages?: { label: string; count: number; total: number }[];
  reward?: { label: string; value: string; observe?: (show:(value:string)=>void)=>()=>void };
  details?: { label: string; body: string }[];
  bosses?: { name: string; image?: string }[];
  party?: { name: string; portrait?: string; stats: Stat[]; stars: string }[];
  actions: { label: string; run: () => void }[];
}

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
    append(item, 'dd', String(value));
  }
}

function fold(parent: HTMLElement, label: string) {
  const details = append(parent, 'details');
  append(details, 'summary', label);
  return details;
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
  if (data.stages?.length) {
    const track = append(body, 'ol', '', 'report-stages');
    track.setAttribute('aria-label', '三关战绩');
    for (const stage of data.stages) {
      const item = append(track, 'li');
      item.classList.toggle('cleared', stage.count === stage.total);
      append(item, 'span', stage.label);
      append(item, 'b', stage.count + ' / ' + stage.total);
    }
  }
  figures(body, data.stats);
  let stopReward: (()=>void) | undefined;
  if (data.reward) {
    const reward = append(body, 'div', '', 'report-reward');
    append(reward, 'span', data.reward.label);
    const value=append(reward, 'strong', data.reward.value);
    if(data.reward.observe){value.setAttribute('aria-live','polite');stopReward=data.reward.observe(text=>{value.textContent=text;});}
  }
  for (const member of data.party ?? []) {
    const row = append(body, 'section', '', 'report-member');
    const name = append(row, 'h3');
    if (member.portrait) portrait(name, member.portrait);
    append(name, 'span', member.name);
    figures(row, member.stats);
    if (member.stars) append(row, 'p', member.stars);
  }
  if (data.bosses?.length) {
    const roster = append(fold(body, '已击败名将 · ' + data.bosses.length), 'div', '', 'roster');
    for (const boss of data.bosses) {
      const item = append(roster, 'span');
      if (boss.image) portrait(item, boss.image);
      append(item, 'small', boss.name);
    }
  }
  for (const item of data.details ?? []) append(fold(body, item.label), 'p', item.body);

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

