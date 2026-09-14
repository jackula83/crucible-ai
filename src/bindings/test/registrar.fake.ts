type Registration = {
  name: string;
  fn: () => Promise<void>;
  timeout?: number;
};

class RegistrarFake {
  registrations: Registration[] = [];

  register = (name: string, fn: () => Promise<void>, timeout?: number): void => {
    this.registrations.push({ name, fn, timeout });
  };
}

export { RegistrarFake };
export type { Registration };
