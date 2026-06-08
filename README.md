# Apex Tech Metais - Landing Page Oficial

Bem-vindo ao repositório do site oficial da **Apex Tech Metais**. Este projeto consiste em uma *Landing Page* (Página Única) moderna, responsiva e desenvolvida para apresentar as soluções, serviços, catálogo de sucatas e métricas de mercado (LME) da empresa.

## 📌 Visão Geral do Projeto

A página foi construída com foco em desempenho, estética visual premium e facilidade de navegação, servindo como uma poderosa ferramenta de captação de leads e apresentação institucional no mercado de resíduos industriais e metais.

### 🚀 Principais Seções

1. **Hero Banner (Home)**: Primeira impressão impactante com chamada para ação (CTA) direcionando para o atendimento ou detalhamento das soluções. Possui animações de entrada suaves e efeito visual parallax escurecido para destacar o texto.
2. **Transformando Resíduos (Sobre)**: Seção institucional que explica o propósito da Apex Tech Metais em transformar passivos ambientais em ativos e as áreas de atuação (Comercial, Prestação de Serviços, Consultoria, etc).
3. **Soluções**: Grade responsiva de cards com hover interativo (efeito 3D tilt) apresentando os principais serviços da empresa, como compra e venda de sucatas, gestão de resíduos, e destruição segura de materiais.
4. **Catálogo**: Área dedicada aos tipos de materiais comercializados, substituindo a antiga "Compra e Venda". Exibe ícones intuitivos para Cobre, Alumínio, Motores Elétricos, Resíduos de Obras, entre outros.
5. **Cotações LME (London Metal Exchange)**: Seção de mercado que exibe os valores reais de metais preciosos (Ouro, Prata, Platina, Paládio) cotados em dólares por onça (US$ / oz), com métricas de variação Diária, Semanal e Mensal. Consolida a Apex Tech Metais como referência em consulta do setor.
6. **Footer (Contato)**: Rodapé completo com links rápidos, redes sociais, dados de contato direto (WhatsApp flutuante e E-mail) e direitos autorais.

## 🛠️ Tecnologias Utilizadas

O projeto foi desenvolvido inteiramente com as tecnologias base da Web, sem dependência de frameworks pesados, garantindo carregamento rápido e fácil manutenção:

* **HTML5**: Estruturação semântica de todo o conteúdo.
* **CSS3 (Vanilla)**: Estilização premium com variáveis nativas (`:root`), Flexbox, CSS Grid e animações (`keyframes`, transições de hover). O site possui layout escuro (Dark Mode) adaptado com a paleta da marca (Verde, Preto Escuro).
* **JavaScript (Vanilla)**: Lógica responsável pelo menu mobile (Drawer), *smooth scrolling* ao clicar nos links, efeito de navegação ativa (`Intersection Observer`), animações *fade-up* baseadas em scroll e o efeito 3D nos cards de soluções.
* **FontAwesome 6 (CDN)**: Utilizado para a iconografia vetorial do site.
* **Google Fonts**: Fontes tipográficas 'Lato' e 'Raleway' para melhor legibilidade.

## 📱 Responsividade

O site é 100% responsivo (`Mobile First` em sua adaptação final), garantindo a mesma qualidade visual em monitores ultra-wide, laptops, tablets e smartphones. 
* Breakpoints principais: `1024px`, `768px` e `480px`.
* O menu principal se converte perfeitamente em um "Menu Hamburguer" inteligente na versão mobile, com navegação lateral (Drawer).

## 🔄 Como Atualizar as Cotações LME

Os valores dos metais (Ouro, Prata, Platina, Paládio) na seção **Cotações LME** (`#cotacoes`) estão inseridos diretamente no arquivo `index.html`. 

Para atualizá-los com dados novos baseados em integrações JSON/API, basta localizar a div com a classe `.lme-card` correspondente ao metal (linhas ~330 a 420) e alterar o valor numérico na tag `<div class="lme-price">...</div>`.

## ⚙️ Como Executar o Projeto Localmente

Sendo um projeto estático, não há necessidade de processos de build complexos ou instalações via NPM.

1. Clone o repositório para a sua máquina:
   ```bash
   git clone https://github.com/devjohnnydev/apextech.git
   ```
2. Navegue até o diretório do projeto:
   ```bash
   cd apextech
   ```
3. Abra o arquivo `index.html` diretamente em qualquer navegador web moderno.
4. *(Recomendado)*: Utilize a extensão **Live Server** do VS Code para testar o site com hot-reload (atualizações em tempo real ao salvar o código).

---

> Desenvolvido e projetado para excelência visual e funcional no mercado de metais sustentáveis. 🌿
