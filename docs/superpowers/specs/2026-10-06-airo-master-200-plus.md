# AIRO — Master 200+ Product & Implementation Contract

**Workspace:** Kelompok Pengorgan  
**Status:** Source of Truth  
**Updated:** 2026-10-06

This contract consolidates the approved AIRO rebuild requirements. Each item must map to code/database/UI/QA before it may be marked DONE.

## 01 Product Core

1. Single workspace: Kelompok Pengorgan.
2. No active Daerah/Desa/Kelompok hierarchy.
3. Caberawit, Muda-Mudi, Ibu-Ibu are independent programs.
4. Pengurus is a position, not a program.
5. One person equals one master identity.
6. Enter data once and reuse it across modules.
7. Event is the operational center.
8. Attendance, journal, progress, recap and report use real IDs.
9. Historical truth must survive future changes.
10. AI may analyze but may not invent official facts.

## 02 People & Person 360

11. Stable person/member ID.
12. Core biodata belongs to person domain.
13. Person supports active, inactive and archived lifecycle.
14. Person 360 overview.
15. Person 360 membership tab.
16. Person 360 attendance tab.
17. Person 360 journal tab.
18. Person 360 progress tab.
19. Person 360 position tab.
20. Person 360 historical timeline.

## 03 Membership & Position

21. Membership is temporal.
22. Membership has valid_from and valid_to.
23. Membership changes create history instead of overwrite.
24. Levels are configurable data.
25. Classes are configurable and linked to program/level.
26. Ibu-Ibu is never nested under Caberawit.
27. Ibu-Ibu is never nested under Muda-Mudi.
28. Organizational positions are separate from membership.
29. Position has title, section, duties and effective period.
30. One person may hold multiple positions.

## 04 Access & Viewer

31. System role is separate from organizational position.
32. Base roles: Admin, Dewan Guru, Operator, Viewer.
33. Per-user read scope.
34. Per-user write scope.
35. Granular allow/deny permission overrides.
36. Viewer is read-only.
37. Viewer cannot access personal notes.
38. Viewer cannot access internal Pengurus data.
39. Viewer cannot access audit logs.
40. Backend/RLS enforces access independent of UI.

## 05 Event Engine

41. Event has stable ID.
42. Event stores title/type.
43. Event stores date/start/end.
44. Event stores audience/program.
45. Event can store level/class.
46. Event stores PIC/presenter/location.
47. Event can require attendance.
48. Event can require journal/documentation/target linkage.
49. Lifecycle: Draft/Scheduled/Active/Completed/Locked/Cancelled.
50. Locked/cancelled semantics preserve historical data.

## 06 Agenda & Recurrence

51. Month calendar view.
52. Week view.
53. Day view.
54. List view.
55. Dates show event indicators/counts.
56. Date interaction shows day activities.
57. Recurring daily/weekly/monthly.
58. Recurring end date.
59. Edit one/future/all recurrence scope.
60. Agenda links directly to attendance/journal/follow-up.

## 07 Attendance Core

61. Statuses: BELUM/HADIR/IZIN/ALFA.
62. No Submit button.
63. Status tap autosaves immediately.
64. Status can be corrected later by authorized users.
65. Mark All Present only changes BELUM.
66. Mark All Present never overwrites IZIN.
67. Mark All Present never overwrites ALFA.
68. Participant search.
69. Large mobile touch targets.
70. Live completed/total attendance count.

## 08 Attendance Integrity & Offline

71. Participant roster resolved by effective-date membership.
72. Kelompok roster means all active members.
73. Pengurus roster is derived from effective organizational positions.
74. Participant snapshot is created for historical integrity.
75. Snapshot stores name/class/level.
76. Every change has revision number.
77. Change history stores before/after/actor/time.
78. Revision conflicts do not silently overwrite.
79. Offline pending queue and automatic retry.
80. UI states: saving/saved/pending/error/conflict.

## 09 Journal Foundation

81. Central Journal Center.
82. Filter journals by period.
83. Filter journals by journal type.
84. Journal state includes Draft and Completed/Final.
85. Journal draft autosaves.
86. Autosave does not auto-finalize.
87. Journal revision history.
88. Journal archival.
89. Event-linked journal inherits known context.
90. Quick Journal still creates consistent activity relationship.

## 10 Domain Journals

91. Caberawit class journal with multi-material.
92. Caberawit material has page/target/realization.
93. Caberawit journal has method/obstacle/evaluation/follow-up/documentation.
94. Caberawit individual journal is optional per participant.
95. Muda-Mudi has its own journal structure.
96. Ibu-Ibu has a lighter domain-specific journal.
97. Pengurus/Musyawarah records participants, agenda and minutes.
98. Jurnal Pengkajian Kelompok is a separate journal type.
99. Pengkajian supports internal/external presenter and automatic duration.
100. Pengkajian supports multiple material items with BELUM/SEBAGIAN/TUNTAS.

## 11 Musyawarah Decisions

101. Meeting decisions are structured records.
102. Decision has PIC.
103. Decision may have deadline.
104. Decision statuses: OPEN/IN_PROGRESS/COMPLETED/CANCELLED.
105. Overdue is derived from deadline/status.
106. Completed decision may require evidence.
107. Decision has follow-up notes.
108. Follow-up can be filtered by status/PIC.
109. Dashboard/notification can surface overdue items.
110. Decision changes are audit-traceable.

## 12 Target & Progress

111. Target only appears in relevant programs/categories.
112. Target has version/cycle.
113. Target can map by month.
114. Target can link to level and optional class.
115. Manual target creation.
116. Excel target import.
117. Progress source is explicit.
118. Progress has evidence.
119. Progress corrections retain history/reason.
120. AI cannot write official progress without authorized evidence-backed action.

## 13 Personal Notes

121. Personal Catatan is separate from journals.
122. Note has title/body.
123. Note autosaves.
124. Note can be pinned.
125. Note can be searched.
126. Note can be archived.
127. Note can be moved to trash.
128. Notes are private to owner.
129. Notes are excluded from organization reports.
130. Note sync/conflict preserves unsaved text.

## 14 Search & Notifications

131. Global search supports Cmd/Ctrl+K.
132. Search members.
133. Search agenda.
134. Search journals.
135. Search reports.
136. Search organizational positions.
137. Search only current user's private notes.
138. Search respects RLS and scope.
139. Operational Notification Center.
140. Notification read-state is stored per user.

## 15 Dashboard & Completeness

141. Operator dashboard prioritizes today's work.
142. Admin dashboard prioritizes operational health.
143. Today agenda.
144. Incomplete attendance.
145. Unfinished journals.
146. Overdue decisions.
147. Target/progress alerts where relevant.
148. Member data completeness issues.
149. Import failures/partial jobs.
150. Every actionable metric drills down to source.

## 16 Recap & Reporting

151. Recap dimensions: time/program/level/class/person/event.
152. Attendance recap H/I/A and percentage.
153. Recap numbers drill down to source records.
154. Pengkajian recap counts sessions.
155. Pengkajian recap total duration/presenters/material completion.
156. Single reporting dataset for dashboard/recap/exports.
157. Report snapshots preserve published data.
158. Historical correction does not mutate old published version.
159. Report version history.
160. Preview and export use same data source.

## 17 Export & Documents

161. Excel export.
162. Editable Word export.
163. PDF export.
164. Editable PowerPoint export.
165. Report templates.
166. Domain-specific report types.
167. Document output is not a screenshot-only artifact.
168. Editable charts/tables where technically supported.
169. Export failure never deletes transaction data.
170. Publish/export history is traceable.

## 18 Import Archive Attachments

171. Central Import Center.
172. Per-module import templates.
173. Column mapping step.
174. Validation before commit.
175. Preview before commit.
176. Duplicate detection.
177. Merge/skip/create-new decision flow.
178. Per-row errors.
179. Tracked import jobs with row counts/status/errors.
180. Generic evidence/attachment metadata with parent-resource permissions.

## 19 Data Quality & History

181. ACTIVE→INACTIVE→ARCHIVED lifecycle.
182. Permanent delete checks historical dependencies.
183. Historical attendance/journal/progress survives member movement.
184. Current master-data edits do not rewrite historical snapshots.
185. Derived metrics have clear source of truth.
186. Cache is not source of truth.
187. Business timezone Asia/Jakarta.
188. Business date is distinct from system timestamp.
189. Cross-midnight activity duration is valid.
190. Duplicate person detection and completeness engine.

## 20 Security, Audit & System

191. RLS on exposed tables.
192. Permission is not UI-only.
193. No secret/service key in browser.
194. Audit log for core data insert/update/delete.
195. Audit stores actor/resource/before/after/time.
196. Audit is restricted to authorized users.
197. Login history.
198. Admin account activation/deactivation.
199. System health includes import/sync/runtime failures.
200. Security advisor and cross-role testing after sensitive migrations.

## 21 UI, QA & Deployment

201. Light Mode.
202. Purpose-built Dark Mode.
203. Collapsible desktop sidebar.
204. Mobile bottom navigation.
205. Global Quick Add desktop/mobile.
206. Concise UI: title/data/status/action, no gimmick copy.
207. Progressive disclosure and smart defaults.
208. Complete Loading/Empty/Saving/Saved/Error/Offline/Conflict/No Permission/Archived states.
209. QCL: Implement→Test→Inspect→Gap Analysis→Improve→Retest.
210. Production only after compile/type/static generation/runtime checks pass.

## Execution Rule

- No feature is DONE because a menu exists.
- DONE requires functional correctness, data integrity, RLS/permission correctness, historical integrity, responsive UI, edge cases and regression verification.
- Legacy data must not be destructively reset during migration.
