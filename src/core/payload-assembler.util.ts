const FENCE_OPEN = '<<<';
const FENCE_CLOSE = '>>>';

class PayloadAssembler {
  assemble(state: string[], response: string, claim: string): string {
    const sections: string[] = [];
    if (state.length > 0) {
      sections.push(this.section('STATE', state.join('\n')));
    }
    sections.push(this.section('RESPONSE', response));
    sections.push(this.section('CLAIM', claim));
    return sections.join('\n\n');
  }

  private section(header: string, content: string): string {
    return `${header}\n${FENCE_OPEN}\n${this.neutralizeFences(content)}\n${FENCE_CLOSE}`;
  }

  private neutralizeFences(content: string): string {
    return content
      .split('\n')
      .map((line) => (line === FENCE_OPEN || line === FENCE_CLOSE ? ` ${line}` : line))
      .join('\n');
  }
}

export { PayloadAssembler };
