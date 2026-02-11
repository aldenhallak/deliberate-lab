import '../../pair-components/button';
import '../../pair-components/icon_button';
import '../../pair-components/textarea';
import '../../pair-components/tooltip';

import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import {core} from '../../core/core';
import {ExperimentEditor} from '../../services/experiment.editor';

import {
  TranscriptRatingStageConfig,
  RubricCriterion,
  createRubricCriterion,
  DEFAULT_SPEECH_RUBRIC_CRITERIA,
  SILENCE_APPROPRIATENESS_CRITERION,
} from '@deliberation-lab/utils';

import {styles} from './transcript_rating_editor.scss';

/** Editor for configuring Transcript Rating stage */
@customElement('transcript-rating-editor')
export class TranscriptRatingEditor extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly experimentEditor = core.getService(ExperimentEditor);

  @property() stage: TranscriptRatingStageConfig | null = null;

  override render() {
    if (!this.stage) return nothing;

    return html`
      <div class="section">
        <div class="section-header">Transcript Content</div>
        <div class="section-content">
          <pr-textarea
            placeholder="Paste the transcript here..."
            .value=${this.stage.transcript}
            @input=${this.handleTranscriptChange}
          ></pr-textarea>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <span>Rubric Criteria</span>
          <span class="count">${this.stage.criteria.length} selected</span>
        </div>
        <div class="section-content">
          <div class="criteria-actions">
            <pr-button
              variant="tonal"
              color="secondary"
              @click=${this.addAllDefaultCriteria}
            >
              Add All SPEECH_RUBRIC Criteria
            </pr-button>
            <pr-button variant="outlined" @click=${this.addCustomCriterion}>
              + Add Custom Criterion
            </pr-button>
          </div>
          <div class="criteria-list">
            ${this.stage.criteria.map((criterion, index) =>
              this.renderCriterionEditor(criterion, index),
            )}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">Settings</div>
        <div class="section-content">
          <label class="checkbox-row">
            <input
              type="checkbox"
              ?checked=${this.stage.requireAllRatings}
              @change=${this.handleRequireAllChange}
            />
            <span>Require all criteria to be rated before proceeding</span>
          </label>
        </div>
      </div>

      <div class="section">
        <div class="section-header">Available Default Criteria</div>
        <div class="section-content default-criteria">
          ${this.renderDefaultCriteriaSelector()}
        </div>
      </div>
    `;
  }

  private renderCriterionEditor(criterion: RubricCriterion, index: number) {
    return html`
      <div class="criterion-item">
        <div class="criterion-header">
          <span class="criterion-name">${criterion.property}</span>
          <span class="criterion-type">${criterion.type}</span>
          <pr-tooltip text="Remove criterion">
            <pr-icon-button
              icon="delete"
              color="error"
              @click=${() => this.removeCriterion(index)}
            ></pr-icon-button>
          </pr-tooltip>
        </div>
        <div class="criterion-details">
          <pr-textarea
            label="Property Name"
            .value=${criterion.property}
            @input=${(e: InputEvent) =>
              this.updateCriterion(
                index,
                'property',
                (e.target as HTMLTextAreaElement).value,
              )}
          ></pr-textarea>
          <pr-textarea
            label="Description (supports markdown)"
            .value=${criterion.description}
            @input=${(e: InputEvent) =>
              this.updateCriterion(
                index,
                'description',
                (e.target as HTMLTextAreaElement).value,
              )}
          ></pr-textarea>
        </div>
      </div>
    `;
  }

  private renderDefaultCriteriaSelector() {
    const allDefaults = [
      ...DEFAULT_SPEECH_RUBRIC_CRITERIA,
      SILENCE_APPROPRIATENESS_CRITERION,
    ];
    const existingTypes = new Set(
      this.stage?.criteria.map((c) => c.type) ?? [],
    );

    return html`
      <div class="default-criteria-grid">
        ${allDefaults.map((criterion) => {
          const isAdded = existingTypes.has(criterion.type);
          return html`
            <div class="default-criterion ${isAdded ? 'added' : ''}">
              <span class="criterion-name">${criterion.property}</span>
              ${isAdded
                ? html`
                    <pr-icon icon="check_circle" color="primary"></pr-icon>
                  `
                : html`
                    <pr-button
                      variant="text"
                      size="small"
                      @click=${() => this.addDefaultCriterion(criterion)}
                    >
                      Add
                    </pr-button>
                  `}
            </div>
          `;
        })}
      </div>
    `;
  }

  private handleTranscriptChange(e: InputEvent) {
    if (!this.stage) return;
    const transcript = (e.target as HTMLTextAreaElement).value;
    this.experimentEditor.updateStage({...this.stage, transcript});
  }

  private handleRequireAllChange(e: Event) {
    if (!this.stage) return;
    const requireAllRatings = (e.target as HTMLInputElement).checked;
    this.experimentEditor.updateStage({...this.stage, requireAllRatings});
  }

  private addDefaultCriterion(criterion: RubricCriterion) {
    if (!this.stage) return;
    // Create a copy with a new ID
    const newCriterion = createRubricCriterion({
      ...criterion,
      id: undefined, // Will generate new ID
    });
    const criteria = [...this.stage.criteria, newCriterion];
    this.experimentEditor.updateStage({...this.stage, criteria});
  }

  private addAllDefaultCriteria() {
    if (!this.stage) return;
    const existingTypes = new Set(this.stage.criteria.map((c) => c.type));
    const newCriteria = DEFAULT_SPEECH_RUBRIC_CRITERIA.filter(
      (c) => !existingTypes.has(c.type),
    ).map((c) => createRubricCriterion({...c, id: undefined}));
    const criteria = [...this.stage.criteria, ...newCriteria];
    this.experimentEditor.updateStage({...this.stage, criteria});
  }

  private addCustomCriterion() {
    if (!this.stage) return;
    const newCriterion = createRubricCriterion({
      property: 'New Criterion',
      type: 'custom_criterion',
      description: 'Enter description with rating scale here...',
    });
    const criteria = [...this.stage.criteria, newCriterion];
    this.experimentEditor.updateStage({...this.stage, criteria});
  }

  private removeCriterion(index: number) {
    if (!this.stage) return;
    const criteria = this.stage.criteria.filter((_, i) => i !== index);
    this.experimentEditor.updateStage({...this.stage, criteria});
  }

  private updateCriterion(
    index: number,
    field: keyof RubricCriterion,
    value: string | number,
  ) {
    if (!this.stage) return;
    const criteria = [...this.stage.criteria];
    criteria[index] = {...criteria[index], [field]: value};
    this.experimentEditor.updateStage({...this.stage, criteria});
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'transcript-rating-editor': TranscriptRatingEditor;
  }
}
