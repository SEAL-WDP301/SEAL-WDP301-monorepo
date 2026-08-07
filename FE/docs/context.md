# SEAL – Software Engineering Hackathon Management System

## 1. Project Overview

**English name:** SEAL – Software Engineering Hackathon Management System

The Software Engineering Agile League (SEAL) is an annual academic hackathon organized by the Software Engineering Department and PDP at FPT University Ho Chi Minh City. SEAL runs three hackathon events each year, corresponding to the Spring, Summer, and Fall semesters.

Each hackathon may contain multiple competition rounds, such as a qualifying round and a final round.

SEAL events are open to students from multiple universities. A team may consist entirely of FPT University students, a mix of FPT University and external students, or students from partner universities.

Event operations are currently handled largely through manual processes, which are prone to errors and provide limited transparency. In addition to delivering a competition management platform, the project studies the consistency of judges' scores in hackathons. This is an important but under-researched factor in competition fairness. The system therefore serves both as an event management platform and as a data collection tool for research into inter-rater reliability in software engineering assessment.

## 2. Current Problems

The current event management process has several limitations:

- **Manual registration and management:** Manual team registration and track management cause delays and data-entry errors.
- **Fragmented evaluation process:** Each judge scores submissions in a separate Excel file. Results must then be collected and entered manually, which is slow and error-prone.
- **Limited communication:** Communication channels between organizers, mentors, teams, and participants are limited.
- **Limited transparency:** Evaluation decisions have no audit trail, reducing the transparency and credibility of the results.

## 3. Actors

- Team Member
- Team Leader
- Mentor
- Judge (Internal or Guest)
- Event Coordinator (Software Engineering Department or PDP staff)

## 4. Main Features

### 4.1. Event and Round Management

- Create and manage hackathon events.
- Configure multiple rounds for each event, such as qualifying and final rounds.
- Configure submission deadlines, judge assignments, and evaluation criteria for each round.
- Define advancement rules, such as promoting the top N teams from each track to the next round.

### 4.2. Criteria Management

- Maintain reusable default criteria templates.
- Allow each event to inherit a template and add, remove, or adjust criteria and weights.

### 4.3. Track Management

- Create competition tracks for each event.
- Assign mentors to tracks. A lecturer may mentor one track and judge another track in the same event.

### 4.4. Team Management

- Create teams of three to five members.
- Register each team for a specific track.

### 4.5. Authentication and User Management

- All participants authenticate with an email address and password using JWT.
- Classify participants during registration:
  - FPT University students provide an FPT student ID.
  - External students provide a student ID and university name.
- Require organizer approval before an account can participate in a competition.
- Let organizers create temporary accounts for guest judges, with access limited to their assigned rounds.

### 4.6. Submissions

- Teams submit work for each round by providing URLs for the project repository, demo, report, or presentation.
- Optionally integrate with the GitHub or GitLab API to retrieve repository metadata automatically.

### 4.7. Evaluation

- Judges score submissions using event-specific criteria. Each judge's score for every criterion is stored separately.
- Organizers assign internal and guest judges to rounds as needed.

### 4.8. Scoring, Ranking, and Elimination

- Rank teams automatically by round, track, and overall event results.
- Determine which teams qualify for the next round.
- Allow organizers to disqualify teams or submissions that violate competition rules, invalidate their results, and record a reason.
- Keep an audit log for all scoring and disqualification actions.

### 4.9. Research Data Collection

- Store each judge's criterion-level scores for every submission without merging them.
- Provide a calibration round in which judges score a sample submission and review the score distribution to improve agreement.
- Export an anonymized evaluation dataset as CSV for inter-rater reliability analysis.
- Display score variance between judges for each criterion on a dashboard.

### 4.10. Prizes

- Award prizes based on ranking results.
- Notify participants and publish competition results.
- Export rankings and score reports as CSV or Excel files.

## 5. Key Entities

- **Hackathon Event:** A hackathon competition event
- **Track:** A competition category, such as AI, Web, or Mobile
- **Round:** A competition stage, such as a qualifying or final round
- **Team:** A competition team
- **Team Member:** A student participating in a team
- **Mentor:** A person who guides teams
- **Judge:** An internal or guest evaluator
- **Submission:** Work submitted by a team for a round
- **Score/Ranking:** Evaluation scores and ranking results
- **Prize:** An award granted based on competition results

## 6. Research Questions

**Main research question:** How consistent are hackathon evaluation scores across different judges evaluating the same submission in academic software engineering competitions?

**Sub-questions:**

- **RQ1:** What is the overall inter-rater reliability (ICC, Krippendorff's α) of SEAL hackathon scoring?
- **RQ2:** Which scoring criteria show the highest and lowest inter-rater agreement (technical criteria versus soft or subjective criteria)?
- **RQ3:** Does judge type (Software Engineering faculty versus guest judge) affect scoring consistency?
