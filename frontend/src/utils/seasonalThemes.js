// Seasonal themes configuration
export const getSeasonalTheme = () => {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();

  // Natal (December)
  if (month === 12 || (month === 1 && day <= 6)) {
    return {
      name: 'natal',
      colors: {
        primary: 'from-red-600 to-green-600',
        accent: 'bg-red-500',
        text: 'text-red-700'
      },
      decorations: '❄️🎄🎅',
      emoji: '🎄',
      message: 'Feliz Natal!'
    };
  }

  // Ano Novo (January 1-15)
  if (month === 1 && day <= 15) {
    return {
      name: 'ano-novo',
      colors: {
        primary: 'from-yellow-400 to-orange-500',
        accent: 'bg-yellow-500',
        text: 'text-yellow-700'
      },
      decorations: '🎉🎊✨',
      emoji: '🎉',
      message: 'Feliz Ano Novo!'
    };
  }

  // Carnaval (February/March - usually)
  if ((month === 2 && day >= 15) || (month === 3 && day <= 5)) {
    return {
      name: 'carnaval',
      colors: {
        primary: 'from-pink-500 via-purple-500 to-blue-500',
        accent: 'bg-pink-500',
        text: 'text-pink-700'
      },
      decorations: '🎭🎉🎊',
      emoji: '🎭',
      message: 'Feliz Carnaval!'
    };
  }

  // Páscoa (March/April)
  if ((month === 3 && day >= 20) || (month === 4 && day <= 20)) {
    return {
      name: 'pascoa',
      colors: {
        primary: 'from-pink-400 to-purple-400',
        accent: 'bg-pink-400',
        text: 'text-pink-600'
      },
      decorations: '🐰🥚🌷',
      emoji: '🐰',
      message: 'Feliz Páscoa!'
    };
  }

  // Festa Junina (June)
  if (month === 6) {
    return {
      name: 'festa-junina',
      colors: {
        primary: 'from-orange-500 to-yellow-500',
        accent: 'bg-orange-500',
        text: 'text-orange-700'
      },
      decorations: '🌽🎪🔥',
      emoji: '🌽',
      message: 'Feliz Festa Junina!'
    };
  }

  // Halloween (October)
  if (month === 10) {
    return {
      name: 'halloween',
      colors: {
        primary: 'from-orange-600 to-purple-900',
        accent: 'bg-orange-600',
        text: 'text-orange-700'
      },
      decorations: '🎃👻🦇',
      emoji: '🎃',
      message: 'Feliz Halloween!'
    };
  }

  // Default theme
  return {
    name: 'default',
    colors: {
      primary: 'from-purple-500 to-pink-500',
      accent: 'bg-purple-600',
      text: 'text-purple-700'
    },
    decorations: '',
    emoji: '',
    message: ''
  };
};

export const themes = {
  auto: getSeasonalTheme(),
  natal: {
    name: 'natal',
    colors: {
      primary: 'from-red-600 to-green-600',
      accent: 'bg-red-500',
      text: 'text-red-700'
    },
    decorations: '❄️🎄🎅',
    emoji: '🎄',
    message: 'Feliz Natal!'
  },
  carnaval: {
    name: 'carnaval',
    colors: {
      primary: 'from-pink-500 via-purple-500 to-blue-500',
      accent: 'bg-pink-500',
      text: 'text-pink-700'
    },
    decorations: '🎭🎉🎊',
    emoji: '🎭',
    message: 'Feliz Carnaval!'
  },
  'ano-novo': {
    name: 'ano-novo',
    colors: {
      primary: 'from-yellow-400 to-orange-500',
      accent: 'bg-yellow-500',
      text: 'text-yellow-700'
    },
    decorations: '🎉🎊✨',
    emoji: '🎉',
    message: 'Feliz Ano Novo!'
  },
  pascoa: {
    name: 'pascoa',
    colors: {
      primary: 'from-pink-400 to-purple-400',
      accent: 'bg-pink-400',
      text: 'text-pink-600'
    },
    decorations: '🐰🥚🌷',
    emoji: '🐰',
    message: 'Feliz Páscoa!'
  },
  default: {
    name: 'default',
    colors: {
      primary: 'from-purple-500 to-pink-500',
      accent: 'bg-purple-600',
      text: 'text-purple-700'
    },
    decorations: '',
    emoji: '',
    message: ''
  }
};
