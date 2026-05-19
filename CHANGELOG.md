# ThunderTools - Changelog

## v1.2.0 - Gestão de Programas

### 🆕 Novas Abas
1. **Programas** 📦
   - Instalação automatizada via Winget
   - Softwares comuns: Chrome, WinRAR, 7-Zip, VLC, VS Code, Discord, Spotify
   - Sistema de feedback visual para progresso de instalação

## v1.1.0 - Melhorias de UX e Novas Funcionalidades

### 🎨 Melhorias Visuais
- **Microanimações**: Fade in (300ms), sidebar deslizando (400ms), hover suave (250ms)
- **Indicadores gráficos**: Mini progress bars para CPU/RAM com cores dinâmicas
- **Profundidade aprimorada**: Múltiplas camadas de sombra (inset top/bottom)
- **Hierarquia de texto**: Títulos maiores (14px), descrições mais opacas
- **Status visual limpo**: Formato "Status: 🟢 Executando" em vez de textos longos

### 🆕 Novas Abas
1. **Segurança** 🔒
   - Scan rápido Windows Defender
   - Atualizar definições do Defender
   - Status do Firewall
   - Listar programas instalados
   - Verificar portas abertas
   - Conexões de rede ativas

2. **Avançado** ⚙️
   - Limpar arquivos temporários (%temp%, prefetch)
   - Listar programas de inicialização
   - Alterar DNS (Google 8.8.8.8 / Cloudflare 1.1.1.1)
   - Verificar saúde dos discos
   - Limpar WinSxS
   - Otimizar SSD (TRIM)
   - Criar ponto de restauração

3. **Histórico** 📜
   - Registro de todos os comandos executados
   - Status de sucesso/erro
   - Data e hora de execução
   - Armazenamento local (máximo 50 itens)
   - Botão para limpar histórico

4. **Favoritos** ⭐
   - Marcar ferramentas mais usadas
   - Acesso rápido às favoritas
   - Botão de estrela em cada ferramenta
   - Sincronização via localStorage

### 🎯 Funcionalidades UX
- **Toggle Tema Escuro/Claro**: Botão no header para alternar entre temas
- **Sistema de Favoritos**: Clique na estrela para adicionar/remover favoritos
- **Histórico Persistente**: Todos os comandos são salvos localmente
- **Parsers Inteligentes**: 30+ parsers para exibir resultados formatados
- **Modal de Input**: Sistema de diálogo premium para comandos personalizados
- **Comandos Interativos**: Renomear Admin, Renomear PC, Mensagem customizada

### 🔧 Melhorias no Sistema
- **Chave do Windows**: Exibe a chave de produto original
- **DNS Rápido**: Configuração rápida de DNS Google ou Cloudflare
- **Limpeza Avançada**: Remove temp, prefetch e cache do Windows
- **Segurança**: Scan e atualização do Windows Defender
- **Otimização SSD**: Comando TRIM para SSDs
- **Renomear Administrador**: Altera nome da conta Admin com input customizado
- **Renomear Computador**: Altera nome do PC na rede com modal interativo
- **Mensagem Personalizada**: Envia mensagem customizada para usuários do sistema

### 📊 Estatísticas
- **Total de ferramentas**: 43+ (era 30)
- **Total de abas**: 8 (era 6)
- **Parsers**: 40+ (era 25)
- **Animações**: 10+ microanimações
- **Temas**: 2 (escuro e claro)
- **Comandos interativos**: 3 (com modal de input)

### 🎨 Design System
- **Cores em camadas**: Fundo escuro transparente, glow suave, gradientes vivos
- **Progress bars**: Verde (<60%), Amarelo (60-85%), Vermelho (>85%)
- **Profundidade**: 5 camadas de sombra nos toasts
- **Transições**: 200-400ms para todas as animações

### 💾 Armazenamento Local
- Histórico de comandos (50 últimos)
- Lista de favoritos
- Preferência de tema
- Persistência entre sessões

---

## v1.0.0 - Versão Inicial
- 6 abas principais (Impressão, Windows Update, Desempenho, Disco, Rede, Sistema)
- 30 ferramentas de manutenção
- Sistema de toasts flutuantes
- Live stats (CPU, RAM, Clock)
- Design premium com gradientes e glows
