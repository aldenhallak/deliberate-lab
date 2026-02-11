import '../../pair-components/button';
import '../../pair-components/icon';
import '../../pair-components/tooltip';
import '../stages/stage_description';
import '../stages/stage_footer';

import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';

import {convertMarkdownToHTML} from '../../shared/utils';

import {core} from '../../core/core';
import {ExperimentService} from '../../services/experiment.service';
import {ParticipantService} from '../../services/participant.service';
import {ParticipantAnswerService} from '../../services/participant.answer';

import {
  TranscriptRatingStageConfig,
  TranscriptRatingStageParticipantAnswer,
  RubricCriterion,
  StageKind,
  isTranscriptRatingComplete,
  getRatedCriteriaCount,
  ChatMessage,
} from '@deliberation-lab/utils';

import {styles} from './transcript_rating_view.scss';

/** Participant view for Transcript Rating stage - side-by-side layout */
@customElement('transcript-rating-view')
export class TranscriptRatingView extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly experimentService = core.getService(ExperimentService);
  private readonly participantService = core.getService(ParticipantService);
  private readonly participantAnswerService = core.getService(
    ParticipantAnswerService,
  );

  @property() stage: TranscriptRatingStageConfig | null = null;

  get answer(): TranscriptRatingStageParticipantAnswer | null {
    if (!this.stage) return null;
    const answer = this.participantAnswerService.answerMap[this.stage.id];
    if (!answer || answer.kind !== StageKind.TRANSCRIPT_RATING) return null;
    return answer as TranscriptRatingStageParticipantAnswer;
  }

  get ratingMap(): Record<string, number> {
    return this.answer?.ratingMap ?? {};
  }

  get feedbackMap(): Record<string, string> {
    return this.answer?.feedbackMap ?? {};
  }

  override render() {
    if (!this.stage) return nothing;

    return html`
      <stage-description .stage=${this.stage}></stage-description>
      <div class="transcript-rating-container">
        <div class="panel transcript-panel">
          <div class="panel-header">
            <pr-icon icon="description"></pr-icon>
            <span>Transcript</span>
          </div>
          <div class="panel-content transcript-content">
            ${this.renderTranscript()}
          </div>
        </div>
        <div class="panel rubric-panel">
          <div class="panel-header">
            <pr-icon icon="rate_review"></pr-icon>
            <span>Rating Criteria</span>
            <span class="progress-indicator">
              ${getRatedCriteriaCount(this.stage.criteria, this.ratingMap)} /
              ${this.stage.criteria.length}
            </span>
          </div>
          <div class="panel-content rubric-content">
            ${this.renderRubricCriteria()}
          </div>
        </div>
      </div>
      <stage-footer .disabled=${!this.canSubmit()}> </stage-footer>
    `;
  }

  private renderTranscript() {
    if (!this.stage) return nothing;

    if (
      this.stage.useStructuredTranscript &&
      this.stage.transcriptMessages.length > 0
    ) {
      return html`
        <div class="structured-transcript">
          ${this.stage.transcriptMessages.map(
            (message: ChatMessage) => html`
              <div class="message">
                <div class="message-header">
                  <span class="speaker"
                    >${message.profile?.name ?? 'Unknown'}</span
                  >
                  ${message.timestamp
                    ? html`
                        <span class="timestamp"
                          >${new Date(
                            message.timestamp as unknown as number,
                          ).toLocaleTimeString()}</span
                        >
                      `
                    : nothing}
                </div>
                <div class="message-body">${message.message}</div>
              </div>
            `,
          )}
        </div>
      `;
    }

    // Plain text/markdown transcript - preserve newlines as <br> tags
    // Markdown normally treats single newlines as spaces, so we convert to <br>
    const transcriptWithBreaks = this.stage.transcript.replace(/\n/g, '  \n');
    return html`
      <div class="plain-transcript">
        ${unsafeHTML(convertMarkdownToHTML(transcriptWithBreaks))}
      </div>
    `;
  }

  private renderRubricCriteria() {
    if (!this.stage) return nothing;

    return html`
      <div class="criteria-list">
        ${this.stage.criteria.map((criterion: RubricCriterion) =>
          this.renderCriterion(criterion),
        )}
      </div>
    `;
  }

  private renderCriterion(criterion: RubricCriterion) {
    const currentRating = this.ratingMap[criterion.id];
    const ratings = Array.from(
      {length: criterion.maxValue - criterion.minValue + 1},
      (_, i) => criterion.minValue + i,
    );

    return html`
      <div class="criterion ${currentRating !== undefined ? 'rated' : ''}">
        <div class="criterion-header">
          <div class="criterion-title">
            <span class="property">${criterion.property}</span>
            <span class="importance importance-${criterion.importance}">
              ${criterion.importance}
            </span>
          </div>
        </div>

        <div class="criterion-description">
          ${unsafeHTML(convertMarkdownToHTML(criterion.description))}
        </div>

        <div class="rating-scale">
          <span class="scale-label low">${criterion.lowLabel}</span>
          <div class="rating-options">
            ${ratings.map(
              (value: number) => html`
                <label
                  class="rating-option ${currentRating === value
                    ? 'selected'
                    : ''}"
                >
                  <input
                    type="radio"
                    name="rating-${criterion.id}"
                    value=${value}
                    ?checked=${currentRating === value}
                    @change=${() =>
                      this.handleRatingChange(criterion.id, value)}
                  />
                  <span class="rating-value">${value}</span>
                </label>
              `,
            )}
          </div>
          <span class="scale-label high">${criterion.highLabel}</span>
        </div>
      </div>
    `;
  }

  private handleRatingChange(criterionId: string, value: number) {
    if (!this.stage) return;
    this.participantAnswerService.updateTranscriptRatingAnswer(
      this.stage.id,
      criterionId,
      value,
    );
  }

  private canSubmit(): boolean {
    if (!this.stage) return false;
    return isTranscriptRatingComplete(
      this.stage.criteria,
      this.ratingMap,
      this.stage.requireAllRatings,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'transcript-rating-view': TranscriptRatingView;
  }
}
