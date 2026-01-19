// POST /api/auth/discord
router.post('/discord', async (req, res) => {
  try {
    const { discordId, email, username, avatar, discriminator } = req.body;

    // Busca ou cria usuário
    let user = await User.findOne({ discordId });

    if (!user) {
      user = new User({
        discordId,
        email,
        username,
        avatar,
        discriminator,
        provider: 'discord'
      });
      await user.save();
    } else {
      // Atualiza dados se já existe
      user.username = username;
      user.avatar = avatar;
      user.discriminator = discriminator;
      await user.save();
    }

    // Gera token JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Erro no login Discord:', error);
    res.status(500).json({ error: 'Erro ao autenticar com Discord' });
  }
});