INSERT OR IGNORE INTO products (id, slug, name, description, base_price, deposit_percentage, is_active, display_order)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'esencial', 'Punto Esencial', 'Landing page profesional para empezar con claridad.', 9900, 50, 1, 1),
  ('00000000-0000-4000-8000-000000000002', 'profesional', 'Punto Profesional', 'Sitio corporativo personalizado y preparado para crecer.', 18900, 50, 1, 2),
  ('00000000-0000-4000-8000-000000000003', 'tienda', 'Punto Tienda', 'Catálogo y experiencia de compra lista para operar.', 39900, 50, 1, 3),
  ('00000000-0000-4000-8000-000000000004', 'medida', 'Punto a Medida', 'Portales, sistemas e integraciones con alcance personalizado.', NULL, 50, 1, 4);

INSERT OR IGNORE INTO addons (id, slug, name, description, price_type, price, is_active)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'blog', 'Blog administrable', 'Publicación de contenido y novedades.', 'fixed', 3900, 1),
  ('10000000-0000-4000-8000-000000000002', 'booking', 'Agenda y citas', 'Reservaciones integradas con calendario.', 'fixed', 4900, 1),
  ('10000000-0000-4000-8000-000000000003', 'catalog', 'Catálogo avanzado', 'Productos organizados sin cobro en línea.', 'fixed', 6900, 1),
  ('10000000-0000-4000-8000-000000000004', 'multilanguage', 'Segundo idioma', 'Estructura y navegación bilingüe.', 'fixed', 5900, 1),
  ('10000000-0000-4000-8000-000000000005', 'copy', 'Redacción comercial', 'Textos para las páginas principales.', 'fixed', 4900, 1),
  ('10000000-0000-4000-8000-000000000006', 'branding', 'Identidad esencial', 'Logotipo, color y sistema visual inicial.', 'fixed', 7900, 1);

INSERT OR IGNORE INTO portfolio_projects (id, slug, name, industry, description, is_concept, is_published)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'lexora', 'Lexora', 'Despacho jurídico', 'Demostración conceptual enfocada en convertir experiencia en confianza.', 1, 1),
  ('20000000-0000-4000-8000-000000000002', 'nova-dental', 'Nova Dental', 'Clínica dental', 'Demostración conceptual enfocada en facilitar citas.', 1, 1),
  ('20000000-0000-4000-8000-000000000003', 'brasa-norte', 'Brasa Norte', 'Restaurante', 'Demostración conceptual enfocada en llevar el ambiente del lugar a pantalla.', 1, 1);
