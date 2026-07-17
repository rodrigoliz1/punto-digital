const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf"]);
const maxSize = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const projectId = String(form.get("projectId") ?? "");
  if (!(file instanceof File) || !projectId) return Response.json({ error: "Archivo o proyecto inválido." }, { status: 400 });
  if (!allowedTypes.has(file.type) || file.size > maxSize) return Response.json({ error: "Formato no permitido o archivo mayor a 10 MB." }, { status: 415 });
  return Response.json({ error: "La carga de archivos se habilitará al conectar el almacenamiento del proyecto.", previewMode: true }, { status: 503 });
}
