/**
 * 战役回顾 · 乱世编年：九关的史事摘要（原创撰写，据《后汉书》《三国志》等常见史载概括；
 * 演义情节明确标注为“演义”）。只做展示，不影响玩法。
 */
export type ChronicleArc = 'huangjin' | 'dongzhuo' | 'qunxiong';
export interface ChronicleStage { code: string; name: string; boss: string; bossTitle: string; seal: string; year: string; story: string; legacy: string }
export interface ChronicleChapter { arc: ChronicleArc; title: string; years: string; intro: string; stages: ChronicleStage[] }

export const CHRONICLE: ChronicleChapter[] = [
  {
    arc: 'huangjin', title: '第一章 · 黄巾之乱', years: '公元184年',
    intro: '“苍天已死，黄天当立。”太平道起于冀州，三十六方同日而起，汉室震动。',
    stages: [
      { code: '1-1', name: '广宗外围', boss: '张梁', bossTitle: '人公将军', seal: '梁', year: '中平元年 · 184',
        story: '张角以太平道聚众数十万，约期起事。汉廷急遣卢植、皇甫嵩等分路讨伐，广宗城外，人公将军张梁拥众据守。',
        legacy: '各地豪杰应募从军，乱世群雄由此登场。' },
      { code: '1-2', name: '下曲阳破阵', boss: '张宝', bossTitle: '地公将军', seal: '宝', year: '中平元年 · 184',
        story: '地公将军张宝据下曲阳，结阵自守，以符水号召部众。皇甫嵩与巨鹿太守郭典合兵围攻，城破，张宝战死。',
        legacy: '黄巾两路主力相继溃散，起事之势大挫。' },
      { code: '1-3', name: '广宗决战', boss: '张角', bossTitle: '天公将军', seal: '角', year: '中平元年 · 184',
        story: '天公将军张角坐镇广宗。史载张角病死于城破之前，张梁战死，皇甫嵩破城，黄巾主力自此瓦解。游戏中改为与张角正面交锋。',
        legacy: '余部散入青、徐、黑山等地，州郡兵权渐重，埋下割据之端。' },
    ],
  },
  {
    arc: 'dongzhuo', title: '第二章 · 讨伐董卓', years: '公元190年',
    intro: '董卓入京，废少帝、立献帝，专擅朝政。关东诸侯推袁绍为盟主，举兵西向。',
    stages: [
      { code: '2-1', name: '汜水关', boss: '华雄', bossTitle: '西凉骁将', seal: '雄', year: '初平元年 · 190',
        story: '董卓遣部将华雄迎击诸侯。正史中华雄于阳人为孙坚所破斩；演义改作“温酒斩华雄”，由关羽出战。',
        legacy: '联军初战告捷，诸侯之名由此传扬。' },
      { code: '2-2', name: '荥阳', boss: '徐荣', bossTitle: '中郎将', seal: '荣', year: '初平元年 · 190',
        story: '曹操引兵西进，于荥阳汴水遭董卓部将徐荣截击，兵败中箭，赖曹洪让马方得脱身。',
        legacy: '联军各怀观望，曹操自此另图根基。' },
      { code: '2-3', name: '虎牢关', boss: '吕布', bossTitle: '飞将', seal: '布', year: '初平元年 · 190',
        story: '吕布骁勇冠绝，“人中吕布，马中赤兔”。“三英战吕布”为演义名篇；史实中董卓不久挟天子西迁长安，焚毁洛阳。',
        legacy: '洛阳化为焦土，联军随之瓦解。' },
    ],
  },
  {
    arc: 'qunxiong', title: '第三章 · 群雄割据', years: '公元192–197年',
    intro: '董卓伏诛，天下无主。旧部作乱、诸侯并起，各据州郡，逐鹿中原。',
    stages: [
      { code: '3-1', name: '长安突围', boss: '李傕', bossTitle: '西凉旧部', seal: '傕', year: '初平三年 · 192',
        story: '王允、吕布合谋诛杀董卓。董卓旧部李傕、郭汜用贾诩之计反攻长安，王允遇害，吕布败走，长安陷于兵火。',
        legacy: '天子流离，关中残破，朝廷威信扫地。' },
      { code: '3-2', name: '宛城夜袭', boss: '张绣', bossTitle: '北地枪王', seal: '绣', year: '建安二年 · 197',
        story: '张绣降曹后复叛，夜袭曹营。典韦死战护主，曹昂、曹安民殁于乱军，曹操仅以身免。',
        legacy: '后张绣再度归曹，于官渡前后屡立战功。' },
      { code: '3-3', name: '寿春讨逆', boss: '袁术', bossTitle: '仲家伪帝', seal: '术', year: '建安二年 · 197',
        story: '袁术于寿春僭号称帝，奢靡无度，江淮饥荒，部众离心。曹操出兵击之，袁术势衰，两年后呕血而亡。',
        legacy: '称帝之举失尽人心，天下诸侯共弃之。' },
    ],
  },
];
