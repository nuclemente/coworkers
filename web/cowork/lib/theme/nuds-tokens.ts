/**
 * Tokens NuDS-in + paleta Nu PJ (Nu Empresas).
 *
 * Espelhados de nubank/nuds-in (src/theme/seed.json), com overrides para Nu PJ:
 *   - primary mais escuro/sóbrio (uso corporativo)
 *   - superfícies pastel lavanda (lounge)
 *   - radius e spacing aumentados (sensação minimalista)
 *
 * Atualizar quando bumpar nuds-in upstream.
 */

// Paleta Nu PJ — tons usados em produtos Empresas
export const nuPj = {
  // Roxos principais
  deep: '#5500AA',          // header / acento profundo
  primary: '#820AD1',       // CTA principal
  soft: '#A05DBA',          // hover/secondary
  lavender: '#E4D5F0',      // tag/chip background
  mist: '#F5EEFB',          // hover sutil
  fog: '#FAF7FD',           // layout background
  // Neutros
  ink: '#191919',           // texto primário
  graphite: '#5C5C5C',      // texto secundário
  fog2: '#9B9B9B',          // texto terciário
  hairline: '#EFEAF4',      // borda quase invisível
  surface: '#FFFFFF',
  // Acentos PJ (status)
  success: '#00A86B',       // verde PJ suave
  warning: '#E29A1F',       // âmbar suave
  danger: '#D9453C',        // vermelho menos saturado
  info: '#3E62D0',
};

export const nudsSeedTokens = {
  // Cores semânticas
  colorPrimary: nuPj.primary,
  colorSuccess: nuPj.success,
  colorWarning: nuPj.warning,
  colorError: nuPj.danger,
  colorInfo: nuPj.info,

  // Superfícies
  colorBgLayout: nuPj.fog,
  colorBgContainer: nuPj.surface,
  colorBgElevated: nuPj.surface,
  colorBorderSecondary: nuPj.hairline,
  colorBorder: nuPj.hairline,
  colorSplit: nuPj.hairline,

  // Texto
  colorText: nuPj.ink,
  colorTextSecondary: nuPj.graphite,
  colorTextTertiary: nuPj.fog2,

  // Tipografia
  fontFamily:
    "'NuSans', 'NuSans Text', Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontFamilyCode: "'Courier New', Courier, monospace",
  fontSize: 14,

  // Forma — radius maior dá ar minimalista
  borderRadius: 10,
  borderRadiusLG: 14,
  borderRadiusSM: 8,
  controlHeight: 36,

  // Espaçamento
  sizeUnit: 4,
  sizeStep: 4,
  lineWidth: 1,
  lineType: 'solid' as const,
  wireframe: false,

  // Cores nominais (presets de Tag)
  blue: '#3e62d0',
  purple: nuPj.primary,
  cyan: '#73c1e9',
  green: nuPj.success,
  magenta: '#e063b1',
  red: nuPj.danger,
  orange: '#fea44b',
  yellow: '#ebae2e',
  volcano: '#816359',
  geekblue: '#284ec1',
  gold: nuPj.warning,
  lime: '#a0c61b',
};

export const nudsTheme = {
  token: nudsSeedTokens,
  components: {
    Layout: {
      headerBg: nuPj.surface,
      bodyBg: nuPj.fog,
      siderBg: nuPj.surface,
    },
    Card: {
      boxShadowTertiary: '0 1px 3px rgba(25, 25, 25, 0.04)',
      headerBg: 'transparent',
      headerFontSize: 14,
      paddingLG: 20,
    },
    Button: {
      paddingInline: 18,
      controlHeight: 36,
      primaryShadow: 'none',
      defaultShadow: 'none',
      fontWeight: 500,
    },
    Tag: {
      defaultBg: nuPj.mist,
      defaultColor: nuPj.deep,
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: nuPj.mist,
      itemSelectedColor: nuPj.deep,
      itemHoverBg: nuPj.fog,
      itemHeight: 40,
      itemBorderRadius: 8,
    },
    Drawer: {
      paddingLG: 24,
    },
    Modal: {
      paddingContentHorizontalLG: 24,
    },
    Input: {
      paddingBlock: 8,
    },
    Select: {
      paddingBlock: 4,
    },
  },
};
