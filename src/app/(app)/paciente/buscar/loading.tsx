const skeleton = "block rounded-[5px] bg-[#e5edef] motion-safe:animate-pulse";

export default function Loading() {
  return (
    <div className="max-w-[900px] [&_h2]:text-xl" aria-busy="true">
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Buscar un turno médico</h1>
          <p>
            Filtrá por especialidad, profesional y fecha. La reserva se confirma
            en el siguiente paso.
          </p>
        </div>
      </div>
      <div
        className="-mt-2 mb-5 flex gap-2 text-[13px] font-bold"
        aria-label="Pasos de la reserva"
      >
        <span className="bg-brand-soft text-brand rounded-full border border-[#a9c9cb] px-[11px] py-[3px]">
          1 · Elegir horario
        </span>
        <span className="border-line rounded-full border bg-white px-[11px] py-[3px]">
          2 · Confirmar
        </span>
      </div>
      <section className="sigsam-card mb-1" aria-label="Cargando filtros">
        <h2>Encontrá una consulta</h2>
        <div
          className="grid grid-cols-1 gap-x-3 gap-y-[18px] min-[601px]:grid-cols-2"
          aria-hidden="true"
        >
          {Array.from({ length: 4 }, (_, indice) => (
            <div key={indice} className="grid gap-1.5">
              <span className={`${skeleton} h-[18px] w-[35%]`} />
              <span className={`${skeleton} h-11 w-full`} />
            </div>
          ))}
          <span
            className={`${skeleton} col-span-full mt-0.5 h-[38px] w-[190px]`}
          />
        </div>
      </section>
    </div>
  );
}
