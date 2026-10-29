# Segurança do VySCSh — MVP experimental

- **Não exponha TCP/47892 à internet.** Vincule a sala ao IPv4 virtual do Radmin VPN.
- Só compartilhe a chave temporária de 128 bits com participantes confiáveis. Não grave essa chave em arquivos, screenshots ou issues.
- Radmin VPN **não substitui** autorização do VySCSh. A chave protege a entrada na sala; a rede privada limita quem alcança a porta.
- WebSocket `ws://` **não possui criptografia TLS própria**; usa a conectividade privada fornecida pelo Radmin. Planejamos WSS e autenticação Discord antes de acesso público.
- A mídia usa DTLS-SRTP do WebRTC, porém membros autorizados conseguem gravar externamente o que assistem.
- Não desative o firewall do Windows; permita somente o tráfego necessário na interface virtual.
- Não publique logs de SDP/candidatos ICE: podem conter endereços IP privados e metadados de rede.
- O aplicativo não possui gravação automática, controle remoto, instalação de drivers nem inicialização de captura sem ação do host.
- Atualize Electron, Node.js e dependências; execute `npm audit` depois de instalar.
- A ponte Electron limita APIs IPC, usa isolamento de contexto, sandbox e renderer sem Node.js.
- Para relatar vulnerabilidades, contate o mantenedor privadamente pelo GitHub em vez de criar uma issue pública com detalhes exploráveis.

**Não recomendado para:** transmissão pública, compartilhamento de informações confidenciais, servidores não confiáveis ou redes Radmin compartilhadas com desconhecidos.
