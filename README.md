# Sendero Cumbre · Portfolio 3D de Pedro Cassani

Portfolio interactivo 3D en WebGL / Three.js donde recorres un circuito de montaña en moto, saltas lomas pronunciadas haciendo trucos/mortales y visitas 5 estaciones con proyectos reales de ingeniería de sistemas, bases de datos Oracle SQL, integraciones Oil & Gas (SLB), logística WMS Infor y gestión documental.

## Arquitectura del Proyecto

El proyecto está organizado de forma modular y ultraliviana para correr a 60 FPS tanto en navegadores de escritorio como en teléfonos móviles:

```text
├── index.html                  # Punto de entrada y layout del HUD / Controles Mobile
├── server.py                   # Servidor HTTP y API REST en Python (sin caché en desarrollo)
├── package.json                # Configuración y scripts del proyecto
├── css/
│   └── styles.css              # Estilos del HUD, modales y controles táctiles ergonómicos
└── js/
    ├── data/
    │   ├── bikeModel.js        # Modelo 3D GLTF binario embebido y decodificador
    │   └── portfolioData.js    # Datos de las 5 estaciones, íconos SVG y constantes
    ├── world/
    │   └── terrainAndRoutes.js # Generador de terreno, lomas de salto, ruta continua y estaciones 3D
    ├── physics/
    │   └── bikeController.js   # Física de conducción, despegue en lomas, trucos y partículas
    └── ui/
        └── PortfolioHUD.js     # Controlador de escena, clima dinámico, HUD y controles multi-touch
```

## Ejecución Local

```bash
python server.py
```

Luego abre `http://localhost:8080` en tu navegador.
