// Portfolio Stations Data & Shared Helpers
window.PortfolioData = {
  WORLD_R: 95,
  CIRCUIT_RADIUS: 42,
  STATION_RADIUS: 50,
  ROUTE_WIDTH: 3.2,
  SIGN_COLOR: '#4fc3f7',
  STATION_COLORS: [0x5b8cff, 0x38bdf8, 0x5bd3c0, 0x8f6fff, 0xd16bff],
  STATION_ICONS: [
    '<svg viewBox="0 0 48 48" width="48" height="48" fill="none"><rect x="8" y="6" width="32" height="38" rx="3" fill="currentColor" opacity="0.15"/><rect x="8" y="6" width="32" height="38" rx="3" stroke="currentColor" stroke-width="2.5"/><line x1="14" y1="16" x2="34" y2="16" stroke="currentColor" stroke-width="2.5"/><line x1="14" y1="24" x2="34" y2="24" stroke="currentColor" stroke-width="2.5"/><line x1="14" y1="32" x2="26" y2="32" stroke="currentColor" stroke-width="2.5"/><path d="M30 30l3 3 5-6" stroke="#9be37b" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    '<svg viewBox="0 0 48 48" width="48" height="48" fill="none"><path d="M6 20L24 8l18 12v22H6V20z" fill="currentColor" opacity="0.15"/><path d="M6 20L24 8l18 12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linejoin="round"/><rect x="6" y="20" width="36" height="22" stroke="currentColor" stroke-width="2.5" fill="none"/><rect x="14" y="27" width="7" height="7" stroke="currentColor" stroke-width="2"/><rect x="27" y="27" width="7" height="7" stroke="currentColor" stroke-width="2"/></svg>',
    '<svg viewBox="0 0 48 48" width="48" height="48" fill="none"><ellipse cx="24" cy="10" rx="16" ry="6" fill="currentColor" opacity="0.2" stroke="currentColor" stroke-width="2.5"/><path d="M8 10v12c0 3.3 7.2 6 16 6s16-2.7 16-6V10" stroke="currentColor" stroke-width="2.5" fill="none"/><path d="M8 22v12c0 3.3 7.2 6 16 6s16-2.7 16-6V22" stroke="currentColor" stroke-width="2.5" fill="none"/></svg>',
    '<svg viewBox="0 0 48 48" width="48" height="48" fill="none"><path d="M24 6l10 14a10 10 0 11-20 0L24 6z" fill="currentColor" opacity="0.2" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 32a6 6 0 006 6" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.5"/></svg>',
    '<svg viewBox="0 0 48 48" width="48" height="48" fill="none"><rect x="6" y="8" width="11" height="32" rx="2" stroke="currentColor" stroke-width="2.5" fill="currentColor" fill-opacity="0.12"/><rect x="19" y="8" width="11" height="20" rx="2" stroke="currentColor" stroke-width="2.5" fill="currentColor" fill-opacity="0.12"/><rect x="32" y="8" width="11" height="26" rx="2" stroke="currentColor" stroke-width="2.5" fill="currentColor" fill-opacity="0.12"/><rect x="34.5" y="14" width="2.2" height="9" fill="#d4342a"/><rect x="31" y="17.5" width="9" height="2.2" fill="#d4342a"/></svg>'
  ],
  STATION_CONTENT: [
    {
      title: 'Goldenbelt',
      eyebrow: 'Gestión documental',
      desc: 'Reemplacé SharePoint por Goldenbelt en una empresa petrolera para modernizar la gestión documental de toda la organización. Diseñé e implementé flujos de aprobación configurables, control de versiones y permisos por área, migrando miles de documentos sin interrumpir la operación. Todo el proyecto, desde el análisis hasta la puesta en producción, lo saqué adelante en menos de un mes. Ofrezco este tipo de servicio para empresas que necesitan digitalizar y ordenar su gestión documental de forma rápida y confiable.',
      link: null
    },
    {
      title: 'WMS Infor',
      eyebrow: 'Gestión de almacenes',
      desc: 'Implementé el WMS (Warehouse Management System) de Infor para digitalizar la operación completa de un almacén: recepción de mercadería, picking, packing y control de stock en tiempo real. Configuré la integración con los sistemas existentes, capacité a los equipos operativos y acompañé la puesta en marcha hasta estabilizar el proceso. El resultado fue una operación más trazable, con menos errores manuales y visibilidad total del inventario. Puedo ayudarte a implementar o integrar sistemas WMS adaptados a la operación logística de tu empresa.',
      link: null
    },
    {
      title: 'Catalogador de Maestros',
      eyebrow: 'Base de datos Oracle SQL',
      desc: 'Durante años administré una base de datos Oracle SQL con cientos de tablas que contenían información confidencial crítica para el negocio. Diseñé y mantuve consultas SQL complejas para gestionar flujos de aprobación, validar la integridad de datos maestros y generar reportes para distintas áreas. Ese trabajo exigió un manejo profundo de modelado relacional, optimización de consultas y seguridad de la información. Ofrezco servicios de administración de bases de datos, diseño de consultas y gobierno de datos maestros para organizaciones con operaciones complejas.',
      link: null
    },
    {
      title: 'Integraciones SLB',
      eyebrow: 'Oil & Gas · APIs',
      desc: 'Desarrollé extractores de datos y APIs para integrar sistemas de Schlumberger (SLB) en una planta de yacimiento de oil & gas, conectando información operativa crítica entre plataformas que antes no se comunicaban entre sí. Diseñé la arquitectura de extracción, transformación y entrega de datos, asegurando que la información llegara actualizada y confiable a los equipos de campo y de gestión. Este tipo de integración redujo el trabajo manual y mejoró la toma de decisiones en tiempo real. Puedo desarrollar integraciones a medida entre sistemas industriales y plataformas de gestión para tu operación.',
      link: null
    },
    {
      title: 'Jira Médico',
      eyebrow: 'Gestión sanitaria',
      desc: 'Levanté un sistema completo en Jira en una semana para gestionar licencias médicas y toda la administración de un centro de salud en un yacimiento de gas, desde la solicitud hasta la aprobación y el seguimiento documental. Configuré flujos de trabajo, permisos, formularios y reportes adaptados a las necesidades específicas del equipo médico y administrativo. El sistema permitió ordenar procesos que antes se manejaban manualmente, con tiempos de respuesta mucho más rápidos. Ofrezco implementación express de Jira y otras herramientas de gestión para equipos que necesitan digitalizar procesos rápido y sin fricciones.',
      link: null
    }
  ]
};

window.hexStr = function(n) {
  return '#' + n.toString(16).padStart(6, '0');
};

window.pixHash = function(x, y) {
  var s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};
