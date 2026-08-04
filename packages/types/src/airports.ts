export interface Airport {
  code: string;
  city: string;
  name: string;
  country: string;
}

/**
 * Lista fechada de aeroportos — compartilhada entre `apps/web` (autocomplete
 * na criação/edição de monitor) e `services/api` (validação de origin/
 * destination no POST/PUT /api/monitors), pra nenhum dos dois lados aceitar
 * um código que o outro rejeitaria. Ver _local-bdr-policy-009.
 */
export const AIRPORTS: Airport[] = [
  { code: 'GRU', city: 'São Paulo', name: 'Guarulhos', country: 'Brasil' },
  { code: 'CGH', city: 'São Paulo', name: 'Congonhas', country: 'Brasil' },
  { code: 'VCP', city: 'Campinas', name: 'Viracopos', country: 'Brasil' },
  { code: 'GIG', city: 'Rio de Janeiro', name: 'Galeão', country: 'Brasil' },
  { code: 'SDU', city: 'Rio de Janeiro', name: 'Santos Dumont', country: 'Brasil' },
  { code: 'BSB', city: 'Brasília', name: 'Juscelino Kubitschek', country: 'Brasil' },
  { code: 'CNF', city: 'Belo Horizonte', name: 'Confins', country: 'Brasil' },
  { code: 'PLU', city: 'Belo Horizonte', name: 'Pampulha', country: 'Brasil' },
  { code: 'SSA', city: 'Salvador', name: 'Deputado Luís Eduardo Magalhães', country: 'Brasil' },
  { code: 'REC', city: 'Recife', name: 'Guararapes', country: 'Brasil' },
  { code: 'FOR', city: 'Fortaleza', name: 'Pinto Martins', country: 'Brasil' },
  { code: 'POA', city: 'Porto Alegre', name: 'Salgado Filho', country: 'Brasil' },
  { code: 'CWB', city: 'Curitiba', name: 'Afonso Pena', country: 'Brasil' },
  { code: 'FLN', city: 'Florianópolis', name: 'Hercílio Luz', country: 'Brasil' },
  { code: 'MAO', city: 'Manaus', name: 'Eduardo Gomes', country: 'Brasil' },
  { code: 'BEL', city: 'Belém', name: 'Val de Cans', country: 'Brasil' },
  { code: 'GYN', city: 'Goiânia', name: 'Santa Genoveva', country: 'Brasil' },
  { code: 'VIX', city: 'Vitória', name: 'Eurico de Aguiar Salles', country: 'Brasil' },
  { code: 'NAT', city: 'Natal', name: 'Governador Aluízio Alves', country: 'Brasil' },
  { code: 'MCZ', city: 'Maceió', name: 'Zumbi dos Palmares', country: 'Brasil' },
  { code: 'CGB', city: 'Cuiabá', name: 'Marechal Rondon', country: 'Brasil' },
  { code: 'THE', city: 'Teresina', name: 'Senador Petrônio Portella', country: 'Brasil' },
  { code: 'IGU', city: 'Foz do Iguaçu', name: 'Cataratas', country: 'Brasil' },
  { code: 'LIS', city: 'Lisboa', name: 'Humberto Delgado', country: 'Portugal' },
  { code: 'OPO', city: 'Porto', name: 'Francisco Sá Carneiro', country: 'Portugal' },
  { code: 'MAD', city: 'Madri', name: 'Adolfo Suárez Barajas', country: 'Espanha' },
  { code: 'CDG', city: 'Paris', name: 'Charles de Gaulle', country: 'França' },
  { code: 'LHR', city: 'Londres', name: 'Heathrow', country: 'Reino Unido' },
  { code: 'FCO', city: 'Roma', name: 'Fiumicino', country: 'Itália' },
  { code: 'FRA', city: 'Frankfurt', name: 'Frankfurt am Main', country: 'Alemanha' },
  { code: 'AMS', city: 'Amsterdã', name: 'Schiphol', country: 'Países Baixos' },
  { code: 'MIA', city: 'Miami', name: 'Miami International', country: 'Estados Unidos' },
  { code: 'JFK', city: 'Nova York', name: 'John F. Kennedy', country: 'Estados Unidos' },
  { code: 'EWR', city: 'Nova York', name: 'Newark Liberty', country: 'Estados Unidos' },
  { code: 'MCO', city: 'Orlando', name: 'Orlando International', country: 'Estados Unidos' },
  { code: 'LAX', city: 'Los Angeles', name: 'Los Angeles International', country: 'Estados Unidos' },
  { code: 'IAD', city: 'Washington', name: 'Dulles', country: 'Estados Unidos' },
  { code: 'EZE', city: 'Buenos Aires', name: 'Ezeiza', country: 'Argentina' },
  { code: 'SCL', city: 'Santiago', name: 'Arturo Merino Benítez', country: 'Chile' },
  { code: 'LIM', city: 'Lima', name: 'Jorge Chávez', country: 'Peru' },
  { code: 'BOG', city: 'Bogotá', name: 'El Dorado', country: 'Colômbia' },
  { code: 'MEX', city: 'Cidade do México', name: 'Benito Juárez', country: 'México' },
  { code: 'CUN', city: 'Cancún', name: 'Cancún International', country: 'México' },
  { code: 'PUJ', city: 'Punta Cana', name: 'Punta Cana International', country: 'República Dominicana' },
  { code: 'MVD', city: 'Montevidéu', name: 'Carrasco', country: 'Uruguai' },
  { code: 'DXB', city: 'Dubai', name: 'Dubai International', country: 'Emirados Árabes Unidos' },
  { code: 'DOH', city: 'Doha', name: 'Hamad International', country: 'Catar' },
];

export function findAirport(code: string): Airport | undefined {
  return AIRPORTS.find((a) => a.code === code.toUpperCase().trim());
}

export function searchAirports(query: string): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return AIRPORTS.filter(
    (a) => a.code.toLowerCase().includes(q) || a.city.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
  ).slice(0, 8);
}
