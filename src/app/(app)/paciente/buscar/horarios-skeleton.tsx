const skeleton = "block rounded-[5px] bg-[#e5edef] motion-safe:animate-pulse";
const horario =
  "grid min-h-[126px] w-full content-center justify-items-center gap-1 rounded-md border p-[7px] text-center leading-[1.25]";

export function HorariosSkeleton({
  cantidad = 4,
  titulo = "Horarios",
}: {
  cantidad?: number;
  titulo?: string;
}) {
  return (
    <section aria-label={titulo} aria-busy="true">
      <div className="sigsam-section-head">
        <h2>{titulo}</h2>
      </div>
      {cantidad > 0 ? (
        <div className="sigsam-card !p-[18px]">
          <div
            className="grid grid-cols-2 gap-2 min-[601px]:grid-cols-4"
            aria-hidden="true"
          >
            {Array.from({ length: cantidad }, (_, indice) => (
              <div key={indice} className={`${horario} border-line bg-white`}>
                <span className={`${skeleton} h-4 w-[42%]`} />
                <span className={`${skeleton} h-[11px] w-[64%]`} />
                <span className={`${skeleton} h-[11px] w-[82%]`} />
                <span className={`${skeleton} h-[11px] w-[82%]`} />
                <span className={`${skeleton} h-[11px] w-[64%]`} />
              </div>
            ))}
          </div>
          <p className="text-muted !mt-[14px] text-[13px]">
            Los horarios pueden cambiar. Visualizar o elegir uno no garantiza el
            cupo.
          </p>
        </div>
      ) : (
        <div
          className="sigsam-empty grid justify-items-center gap-2"
          aria-hidden="true"
        >
          <span className={`${skeleton} h-[14px] w-[70%] max-w-[350px]`} />
          <span className={`${skeleton} h-[14px] w-[48%] max-w-[240px]`} />
        </div>
      )}
      <span className="sr-only" role="status">
        Cargando horarios…
      </span>
    </section>
  );
}
