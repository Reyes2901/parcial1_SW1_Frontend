import { TestBed } from '@angular/core/testing';

import { BpmnCollaboration } from './bpmn-collaboration';

describe('BpmnCollaboration', () => {
  let service: BpmnCollaboration;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BpmnCollaboration);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
