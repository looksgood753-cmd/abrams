/**
 * data.js — 唯一的数据入口。
 *
 * 配准数值为实测值，直接照抄，不在任何地方重新计算：
 *   p_stage = p_local * s + (tx, ty)
 * 舞台统一为 M1 坐标系，viewBox 为 0 -140 1681 886。
 *
 * parts 是可悬停部件。hits 是命中用的素材图元 id（复制成透明克隆，本身不可见），
 * anchor 是锚点用的图元（缺省等于 hits）；zone 是给"引擎"这种内部结构用的舞台坐标热区。
 */

export const STAGE = Object.freeze({
  x: 0,
  y: -140,
  w: 1681,
  h: 886,
  /** 车体本体在 M1 坐标下的高度，上下各留 140 单位标注带 */
  artH: 606,
});

export const BAND = Object.freeze({
  /** 卡片与车体本体的空隙（舞台单位） */
  gap: 8,
});

/** 时间轴顺序 = 年份顺序，与文件名顺序不同，是故意的。 */
export const ORDER = Object.freeze(['m1', 'ipm1', 'm1a1', 'm1a2', 'm1a2sep', 'm1a2sepv2', 'm1a2sepv3']);

/**
 * 配准校验基准（实测值，不重算）：1 号与 7 号负重轮中心在舞台坐标下的 x。
 * ?debug=1 时画成两条竖线，用来一眼看出地基歪没歪。
 * 纵向残差 1–3 单位是素材精度上限，不修。
 */
export const MARKS = Object.freeze({
  wheel1X: 287.0,
  wheel7X: 1080.8,
  gridStep: 100,
});

// 每个负重轮由 5 个同心图元组成，全要，否则轮心会"漏"到下面的履带上
const WHEELS = [1, 2, 3, 4, 5, 6, 7].flatMap((n) => [
  `road-wheel-${n}-tire`,
  `road-wheel-${n}-rim`,
  `road-wheel-${n}-dish`,
  `road-wheel-${n}-hub`,
  `road-wheel-${n}-cap`,
]);

const GUN_BANDS = (n) => Array.from({ length: n }, (_, i) => `gun-band-${i + 1}`);

const gunPart = (tag, rows, bands) => ({
  key: 'gun',
  name: '主炮',
  tag,
  band: 'top',
  hits: ['gun', ...GUN_BANDS(bands)],
  rows,
});

/** 引擎在车体内部，素材里没有对应图元，用一个舞台坐标热区命中 */
const ENGINE_ZONE = Object.freeze({ x: 108, y: 274, w: 198, h: 58 });

/** SEPv2 车体侧面的附加装甲块（缺的 id 会被自动跳过） */
const ERA_MODULES = Array.from({ length: 16 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return [`hull_module_${n}_upper`, `hull_module_${n}_lower`];
}).flat();

/** SEP / SEPv3 炮塔侧面的 SEP 装甲板 */
const SEP_PANEL = ['sep_panel', 'sep-panel-blade-1', 'sep-panel-blade-2', 'sep-panel-blade-3', 'sep-panel-blade-4', 'sep-panel-blade-5', 'sep-panel-blade-6'];

/** SEPv2 的遥控武器站（rws_* 一组图元） */
const RWS = [
  'rws_bridge', 'rws_stem', 'rws_cradle', 'rws_receiver', 'rws_barrel',
  'rws_shield_side', 'rws_shield', 'rws_ammo', 'rws-pivot', 'rws-pivot-inner',
  'rws-receiver-break',
];

/** SEPv2 炮塔模块化装甲 */
const TURRET_MODULES = Array.from({ length: 7 }, (_, i) => `turret_module_0${i + 1}`);

/** M1A2 系列的七部件；差异项通过 extra 覆盖 */
function a2Parts(extra = {}) {
  return [
    gunPart('M256', [['口径', '120 mm · 滑膛 · L/44'], ['弹药', extra.ammo || 'M829 / M830 / M865']], 8),
    {
      key: 'turret',
      name: '炮塔装甲',
      tag: '复合装甲',
      band: 'top',
      hits: extra.turretHits || ['turret'],
      rows: extra.turretRows || [['结构', '改进型复合装甲'], ['防护', '正面 ≈ 600 mm KE / 900 mm HEAT（出口型评估）']],
    },
    {
      key: 'cupola',
      name: '车长指挥塔',
      tag: '车长独立热像仪',
      band: 'top',
      hits: ['cupola'],
      rows: extra.cupolaRows || [['舱盖', '顶部舱盖'], ['观瞄', '车长独立热像仪']],
    },
    {
      key: 'hull',
      name: '车体装甲',
      tag: '复合装甲',
      band: 'bottom',
      hits: extra.hullHits || ['hull', 'side-skirt-face'],
      rows: extra.hullRows || [['首上', '大倾角复合装甲'], ['防护', '≈ 350 mm KE / 750 mm HEAT（公开评估）']],
    },
    {
      key: 'engine',
      name: '动力舱',
      tag: 'AGT-1500',
      band: 'top',
      zone: ENGINE_ZONE,
      rows: [['形式', '燃气轮机 · 1500 hp'], ['传动', 'X-1100-3B']],
    },
    {
      key: 'suspension',
      name: '悬挂',
      tag: '扭杆',
      band: 'bottom',
      hits: WHEELS,
      rows: extra.suspRows || [['负重轮', '每侧 7 个'], ['减振', '改进型减振器']],
    },
    {
      key: 'track',
      name: '履带',
      tag: '双销式',
      band: 'bottom',
      hits: ['track'],
      rows: [['衬垫', '可更换橡胶块'], ['主动轮', '后置']],
    },
  ];
}


export const VARIANTS = Object.freeze({
  m1: {
    id: 'm1',
    name: 'M1',
    year: 1980,
    navOrder: 0,
    file: 'assets/m1_vector_smooth.svg',
    prefix: 'm1',
    structId: 'm1-structure',
    art: { w: 1681, h: 606 },
    reg: { s: 1.0, tx: 0, ty: 0 },
    note: 'M68A1 105 mm 线膛炮 · 首型',
    photo: 'assets/photos/m1-blur.jpg',
    photoSharp: 'assets/photos/m1.jpg',
    brief:
      '1972 年 XM1 立项，接替因过重过贵而取消的 MBT-70。1976 年 11 月克莱斯勒原型车中选；1980 年 2 月首批生产型车交付，以 1974 年去世的陆军参谋长艾布拉姆斯命名。它把三样新东西装进同一辆车：Burlington 复合装甲、1500 马力的 AGT-1500 燃气轮机、M68A1 105 mm 线膛炮。燃气轮机换来加速性，代价是油耗与滤清负担。105 mm 是当时成熟的选择，炮塔为换装 120 mm 预留了余量。',
    delta: [
      '首型，无前序型号可比。',
      '基准：Burlington 复合装甲 · AGT-1500 燃气轮机 · M68A1 105 mm。',
    ],
    parts: [
      gunPart('M68A1', [['口径', '105 mm · 线膛'], ['弹药', 'M735 / M774 / M456 / M393']], 6),
      {
        key: 'turret',
        name: '炮塔装甲',
        tag: '复合装甲',
        band: 'top',
        hits: ['turret'],
        rows: [['结构', 'Burlington 复合装甲'], ['防护', '正面 ≈ 400 mm KE / 750 mm HEAT（公开评估）']],
      },
      {
        key: 'cupola',
        name: '车长指挥塔',
        tag: '低矮外形',
        band: 'top',
        hits: ['cupola'],
        rows: [['舱盖', '顶部舱盖'], ['观察', '潜望镜环视']],
      },
      {
        key: 'hull',
        name: '车体装甲',
        tag: '复合装甲',
        band: 'bottom',
        hits: ['hull', 'side-skirt-continuous-face', 'side-skirt-face'],
        rows: [['首上', '大倾角复合装甲'], ['防护', '≈ 350 mm KE / 750 mm HEAT（公开评估）']],
      },
      {
        key: 'engine',
        name: '动力舱',
        tag: 'AGT-1500',
        band: 'top',
        zone: ENGINE_ZONE,
        rows: [['形式', '燃气轮机 · 1500 hp'], ['传动', 'X-1100-3B']],
      },
      {
        key: 'suspension',
        name: '悬挂',
        tag: '扭杆',
        band: 'bottom',
        hits: WHEELS,
        rows: [['负重轮', '每侧 7 个'], ['减振', '旋转式减振器']],
      },
      {
        key: 'track',
        name: '履带',
        tag: '双销式',
        band: 'bottom',
        hits: ['track'],
        rows: [['衬垫', '可更换橡胶块'], ['主动轮', '后置']],
      },
    ],
  },

  ipm1: {
    id: 'ipm1',
    name: 'IPM1',
    year: 1984,
    navOrder: 1,
    file: 'assets/ipm1_vector_smooth.svg',
    prefix: 'ipm1',
    structId: 'ipm1-structure',
    art: { w: 1813, h: 618 },
    reg: { s: 0.8951, tx: 10.85, ty: 43.31 },
    note: 'M68A1 105 mm 线膛炮 · 过渡型',
    photo: 'assets/photos/ipm1-blur.jpg',
    photoSharp: 'assets/photos/ipm1.jpg',
    brief:
      'IPM1 是 M1 与 M1A1 之间的过渡型号，编号取自 Improved Performance。1984 年 10 月投产，1986 年 5 月停产，约 894 辆。它把为 120 mm 型研制的 Block I 改进包先装到 105 mm 车上：炮塔装甲加强、尾部加长并加大储物篮，扭杆与减振强化以承受增重。火力不变，仍是 M68A1 105 mm 线膛炮。改进包与 M1A1 同源，但 IPM1 先出厂，两型并行生产过一段时间。',
    delta: [
      '相对 M1：炮塔正面装甲加厚（Block I 方案，与 M1A1 同源，但早约 10 个月出厂）。',
      '相对 M1：悬挂加强，承重提高。',
      '火力不变：仍为 M68A1 105 mm 线膛炮。',
    ],
    parts: [
      gunPart('M68A1', [['口径', '105 mm · 线膛'], ['弹药', 'M735 / M774 / M833 / M456']], 5),
      {
        key: 'turret',
        name: '炮塔装甲',
        tag: '改进型',
        band: 'top',
        hits: ['turret'],
        rows: [['方案', 'Block I 改进装甲 · 与 M1A1 同源'], ['防护', '正面 > 400 mm KE（公开评估）']],
      },
      {
        key: 'cupola',
        name: '车长指挥塔',
        tag: '低矮外形',
        band: 'top',
        hits: ['cupola'],
        rows: [['舱盖', '顶部舱盖'], ['观察', '潜望镜环视']],
      },
      {
        key: 'hull',
        name: '车体装甲',
        tag: '复合装甲',
        band: 'bottom',
        hits: ['hull', 'side-skirt-continuous-face', 'side-skirt-face'],
        rows: [['首上', '大倾角复合装甲'], ['防护', '≈ 350 mm KE / 750 mm HEAT（公开评估）']],
      },
      {
        key: 'engine',
        name: '动力舱',
        tag: 'AGT-1500',
        band: 'top',
        zone: ENGINE_ZONE,
        rows: [['形式', '燃气轮机 · 1500 hp'], ['传动', 'X-1100-3B']],
      },
      {
        key: 'suspension',
        name: '悬挂',
        tag: '改进型',
        band: 'bottom',
        hits: WHEELS,
        rows: [['负重轮', '每侧 7 个'], ['承重', '提高']],
      },
      {
        key: 'track',
        name: '履带',
        tag: '双销式',
        band: 'bottom',
        hits: ['track'],
        rows: [['衬垫', '可更换橡胶块'], ['主动轮', '后置']],
      },
    ],
  },

  m1a1: {
    id: 'm1a1',
    name: 'M1A1',
    year: 1985,
    navOrder: 2,
    file: 'assets/m1a1_vector_smooth.svg',
    prefix: 'm1a1',
    structId: 'm1a1-structure',
    art: { w: 1698, h: 609 },
    reg: { s: 0.9677, tx: -29.44, ty: 5.18 },
    note: 'M256 120 mm 滑膛炮 · 换炮换代',
    photo: 'assets/photos/m1a1-blur.jpg',
    photoSharp: 'assets/photos/m1a1.jpg',
    brief:
      '1985 年 8 月，首辆生产型 M1A1 出厂。相对 IPM1，最大的变化是换装 M256 120 mm 滑膛炮——莱茵金属 Rh-120 L/44 的许可生产型。120 mm 整装弹与 105 mm 弹族不通用，弹舱与装填通道因此重排。装甲沿用 Improved M1 的改进方案，另加集体三防系统。1988 年起的贫铀装甲属于后续批次，不是这一型。1991 年海湾战争中，M1A1 成为联军装甲主力。',
    delta: [
      '相对 IPM1：主炮换为 M256 120 mm 滑膛炮（Rh-120 L/44 授权生产）。',
      '相对 IPM1：弹药改为 120 mm 系列，并加装集体三防系统。',
      '装甲与悬挂：沿用 IPM1 那套 Block I 改进。',
    ],
    parts: [
      gunPart('M256', [['口径', '120 mm · 滑膛 · L/44'], ['弹药', 'M829 / M830 / M865']], 8),
      {
        key: 'turret',
        name: '炮塔装甲',
        tag: '复合装甲',
        band: 'top',
        hits: ['turret'],
        rows: [['正面', 'Block I 改进装甲 · 与 IPM1 同源'], ['防护', '正面 ≈ 600 mm KE / 700 mm HEAT（公开评估）']],
      },
      {
        key: 'cupola',
        name: '车长指挥塔',
        tag: '低矮外形',
        band: 'top',
        hits: ['cupola'],
        rows: [['舱盖', '顶部舱盖'], ['观察', '潜望镜环视']],
      },
      {
        key: 'hull',
        name: '车体装甲',
        tag: '复合装甲',
        band: 'bottom',
        hits: ['hull', 'side-skirt-continuous-face', 'side-skirt-face'],
        rows: [['首上', '大倾角复合装甲'], ['防护', '≈ 350 mm KE / 750 mm HEAT（公开评估）']],
      },
      {
        key: 'engine',
        name: '动力舱',
        tag: 'AGT-1500',
        band: 'top',
        zone: ENGINE_ZONE,
        rows: [['形式', '燃气轮机 · 1500 hp'], ['传动', 'X-1100-3B']],
      },
      {
        key: 'suspension',
        name: '悬挂',
        tag: '扭杆',
        band: 'bottom',
        hits: WHEELS,
        rows: [['负重轮', '每侧 7 个'], ['减振', '沿用 IPM1 加强悬挂']],
      },
      {
        key: 'track',
        name: '履带',
        tag: '双销式',
        band: 'bottom',
        hits: ['track'],
        rows: [['衬垫', '可更换橡胶块'], ['主动轮', '后置']],
      },
    ],
  },
  m1a2: {
    id: 'm1a2',
    name: 'M1A2',
    year: 1992,
    navOrder: 3,
    file: 'assets/m1a2_vector_smooth.svg',
    prefix: 'm1a2',
    structId: 'm1a2-structure',
    art: { w: 1627, h: 575 },
    reg: { s: 0.9957, tx: 0.2463, ty: 22.5955 },
    note: 'M256 120 mm 滑膛炮 · 数字化',
    photo: 'assets/photos/m1a2-blur.jpg',
    photoSharp: 'assets/photos/m1a2.jpg',
    brief:
      '1990 年 4 月，M1A2 的生产计划因预算削减被压缩；1991 年 9 月，62 辆低速初始生产的决定权下放给陆军，1992 年 5 月合约变更，年末首批交付。它把 M1A1 的火力原样保留，重点放在感知与协同：车长独立热像仪让车长拥有独立的观瞄通道，可以一边搜索、一边由炮长接战；车际信息系统把位置、敌情与命令送进车组。火控与导航同步升级，火炮仍是 M256 120 mm 滑膛炮。',
    delta: [
      '相对 M1A1：车长独立热像仪，车长可独立搜索。',
      '相对 M1A1：车际信息系统与数字战场接入。',
      '火力不变：M256 120 mm 滑膛炮。',
    ],
    parts: a2Parts({ ammo: 'M829A1 / M830 / M865' }),
  },

  m1a2sep: {
    id: 'm1a2sep',
    name: 'M1A2 SEP',
    year: 1999,
    navOrder: 4,
    file: 'assets/m1a2_sep_vector_smooth.svg',
    prefix: 'm1a2sep',
    structId: 'm1a2_sep-structure',
    art: { w: 1465, h: 514 },
    reg: { s: 1.0994, tx: 21.2089, ty: 25.6664 },
    note: 'M256 120 mm 滑膛炮 · 系统增强',
    photo: 'assets/photos/m1a2sep-blur.jpg',
    photoSharp: 'assets/photos/m1a2sep.jpg',
    brief:
      'SEP 是 M1A2 的系统增强包（System Enhancement Package）。1999 财年第三季度投产，同年 9 月首批交付。核心是换掉 M1A2 的计算机核心：更快的处理器、彩色平板显示器、更大内存与开放操作系统，车组改用图形界面操作，后续升级也不必重做整套软件。装甲与电子设备同步改进，火炮仍是 M256 120 mm 滑膛炮。这套计算核心此后一直是 SEP 系列升级的基础。',
    delta: [
      '相对 M1A2：计算机核心换代，彩色平板显示与开放系统。',
      '相对 M1A2：装甲与电子设备改进。',
      '火力不变：M256 120 mm 滑膛炮。',
    ],
    parts: a2Parts({
      ammo: 'M829A2 / M830A1 / M865',
      turretRows: [['结构', '复合装甲 + SEP 批次改进'], ['防护', '正面 ≈ 940–960 mm KE（公开评估）']],
      turretHits: ['turret', ...SEP_PANEL],
    }),
  },

  m1a2sepv2: {
    id: 'm1a2sepv2',
    name: 'M1A2 SEPv2',
    year: 2006,
    navOrder: 5,
    file: 'assets/m1a2_sepv2_vector_smooth.svg',
    prefix: 'm1a2sepv2',
    structId: 'm1a2_sepv2-structure',
    art: { w: 1585, h: 738 },
    reg: { s: 1.0387, tx: 9.1570, ty: -169.0842 },
    note: 'M256 120 mm 滑膛炮 · 遥控武器站',
    photo: 'assets/photos/m1a2sepv2-blur.jpg',
    photoSharp: 'assets/photos/m1a2sepv2.jpg',
    brief:
      'SEPv2 是 SEP 的第二个版本。2006 年 12 月签下首批 72 辆改装合同，2007 年 10 至 11 月交付。改进集中在任务电子设备与传动，并预留了安装遥控武器站的能力——车长可以在车内操作 12.7 mm 机枪；配合 TUSK 套件，还能在城区作战时加装反应装甲与枪盾。外观上最明显的是炮塔顶部体积更大的武器站与车体侧面的装甲块。火力仍是 M256 120 mm 滑膛炮。',
    delta: [
      '相对 SEP：任务电子与传动改进，可装遥控武器站。',
      '相对 SEP：配合 TUSK 套件可加装反应装甲与枪盾。',
      '火力不变：M256 120 mm 滑膛炮。',
    ],
    parts: [
      ...a2Parts({
        ammo: 'M829A3 / M830A1 / M865',
        turretRows: [['结构', '复合装甲 + 炮塔顶部武器站'], ['防护', '正面 ≥ 940 mm KE（公开评估）']],
        suspRows: [['负重轮', '每侧 7 个'], ['减振', '传动与悬挂同批改进']],
      }),
      {
        key: 'era',
        name: '爆炸反应装甲',
        tag: 'ARAT II',
        band: 'bottom',
        // TUSK II 的瓦片既贴车体侧面，也覆盖炮塔侧面
        hits: ['turret_module_backing', ...TURRET_MODULES, ...ERA_MODULES],
        rows: [
          ['型号', 'ARAT II · TUSK II 瓦片'],
          ['抗破', '约 500–550 mm 破甲（公开评估）'],
          ['抗穿', '12.7–14.5 mm 弹 / 30 mm 炮'],
        ],
      },
      {
        key: 'rws',
        name: '遥控武器站',
        tag: 'RWS',
        band: 'top',
        hits: [...RWS],
        rows: [
          ['武器', '12.7 mm M2'],
          ['操作', '车长车内遥控'],
          ['观瞄', '昼夜瞄准镜'],
        ],
      },
    ],
  },

  m1a2sepv3: {
    id: 'm1a2sepv3',
    name: 'M1A2 SEPv3',
    year: 2017,
    navOrder: 6,
    file: 'assets/m1a2_sepv3_vector_smooth.svg',
    prefix: 'm1a2sepv3',
    structId: 'm1a2_sepv3-structure',
    art: { w: 1708, h: 665 },
    reg: { s: 0.9755, tx: -10.0348, ty: -43.4719 },
    note: 'M256 120 mm 滑膛炮 · 弹药数据链',
    photo: 'assets/photos/m1a2sepv3-blur.jpg',
    photoSharp: 'assets/photos/m1a2sepv3.jpg',
    brief:
      'SEPv3 是 SEP 系列目前最新的量产型。2017 年投产，同年 10 月 4 日陆军验收首批六辆中的第一辆。它加装了弹药数据链，可为 M829A4 与 AMP 多用途弹编程；新增装甲下的集成式柴油辅助动力单元，静默监视时不必启动燃气轮机；装甲与电子设备升级，车长武器站换成低矮型 CROWS。火力仍是 M256 120 mm 滑膛炮，配套弹药则随数据链更新。',
    delta: [
      '相对 SEPv2：弹药数据链，支持 M829A4 与 AMP。',
      '相对 SEPv2：装甲下柴油 APU，静默监视不启动燃气轮机。',
      '相对 SEPv2：装甲升级，低矮型 CROWS。',
    ],
    parts: a2Parts({
      ammo: 'M829A4 / AMP（数据链编程）',
      turretRows: [['结构', '复合装甲 + 装甲升级'], ['防护', '正面 > 940 mm KE（增重后更高）']],
      suspRows: [['负重轮', '每侧 7 个'], ['减振', '与 SEPv2 同批改进']],
      turretHits: ['turret', ...SEP_PANEL],
    }),
  },
});

