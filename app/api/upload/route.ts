export async function POST() {
  return Response.json({ error: "La carga está deshabilitada hasta conectar identidad, autorización por proyecto, inspección de archivos y almacenamiento privado." }, { status: 503 });
}
