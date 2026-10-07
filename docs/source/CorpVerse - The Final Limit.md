Project name: CorpVerse
The Virtual Corporate simulation with gamification
Tech stack:

- Frontend: React
- Backend: Node
- Database: MongoDB
- File storage: MongoDB
- Ai services: gemini, open-ai, grok api

Main Roles:

- Admin
- Ai manager
- Job seeker
- Employee
- Founder

Platforms Economy:

- EXP: which use for level up as well as to promote role and even to unlock founder mode
- CorpCoin: Which provided after Founder mode unlock using it founder can by bots and setup companies pipeline.

Job Roles:

- Software Developer
- Cloud
- AI Engineer

Other limit still have to decide:

- number of warming before Fired or Demotion
- number of CorpCoin provide when new user become founder
- number of exp required for unlock founder mode.

Problems:

- For freshers who just pass out from college or students who want to practice and experience corporate life with interviews for specific domains, daily tasks for that domain role, and more...
- Nowadays, most companies are using bots to filter out candidates, and most of them do not even give genuine feedback on what areas need improvement as well as what parts are weak...
- Students have a lack of motivation as well as a platform to practice for the specific domain and role they want to achieve.

Main Idea:
(May I not explain this idea in professional as well as technical form, but I explain it in a mix of story and walk-through platform, which and how I imagined it.)

First and foremost, the authentication flow is as follows: when a new user comes, they need to go through the profile creation process. Firstly, they verify their main and set email-password. Then, further in the profile setup, they first set their name which they want to show on the platform. Then, they select a domain from Software Engineer, Cloud Engineer, and Ai Engineer. After that, they add different skills they know and then upload a resume which is stored in MongoDB storage. Also, it scans and all details are extracted and stored in MongoDB (all things are mandatory ). Finally, they review their profile with all given details as well as the extracted data from the resume visualised there and then. Finally, they create a user and from this new user, a job seeker becomes.

Furthermore, I want to talk about the ADMIN role. We can say it is a god of our platform because it has all the powers of editing and monitoring the platform. Also, the ADMIN has one more feature in which there is a different demo of our platform. For the hiring process in project review, the actual hiring process might become lengthy as well as out of control, so in the demo section, we can set which domain, how many questions, and difficulty level can be set. But this process completes the work the same as the actual job seekers’ process, but it is in our control and gives the same feedback. Also, the ADMIN has all access to the platform. The admin can view all users on the platform and also edit them. The admin can monitor and health check the hardcoded ai apis (Gemini, OpenAI, Grok), and more visualisation of all roles’ data.

Moreover, Ai manager, for now, this role is just to provide ai apis and also monitor and set ready fallback APIs and base on limit and health update all things. Basically, hardcoded APIs are used only for demo at admin for other roles and the main pipeline of any companies are use ai which API is set by ai manager also all health and checking are performed by this role. Also, for the starting of our platform where there is no founder, we added three initial companies which are also powered by ai which are managed by ai manager. in conclusion, this role provide ai power all through the platform and just stacks one upon one ai apis as fallback so that everything runs and when one limit reaches, another is used, and ai manger can remove dead APIs and add as many APIs as he wants as fallback.

Now move to the job seeker role. It is an initial role which users become. New users come to create a profile and become job seekers, in which they can explore different companies which are listed as three initial companies with other companies opened by founders. All openings can be seen there, and also they can apply for their desired role and domain after applying for any role and domain. They enter the process of hiring for that company in which all real-world-like processes are performed, but with each and every stage of feedback from ATS scan to final salary/EXP discussion. Wherever users get rejected, they get detailed feedback on what to improve as well as what they can add and work on. For now, interviews are taken in chat mode. Also, all from ATS scan, interview to all process conduct is based on the context of the resume and profile of the user and by ai.

After the user passes the hiring process, they become an employee for that role and domain. Now, they daily have to solve tasks which are well settled and scenario-based. Based on the answers ai review it and from 0 to exp, they discuss in hiring in the range of exp given from that task which is decided by ai and also if the user performs well, then the user gets more exp and promotion, and if the user performs badly, then for 4 times they get a warning, and at the 5th time, they are fired or demoted from that place.

Now when a user reaches a specific amount of exp, then they have the option to unlock Founder Mode. Now when a user unlocks Founder Mode, they get a set amount of CorpCoin, and using it, they have to set up a complete company. Like, by a bot and set it in the company pipeline as a hiring ai, task provider ai, and review/feedback ai. now as a task founder, they have to take decisions as ai daily gives a scenario and options based on that. The company makes a profit or loss, and if the founder makes a loss till one level, then that founder becomes a job seeker back. In the ranking of companies, it is decided by profit, the number of users working in it, the type of ai in the pipeline, etc., and all things are visible.

Also, there is a ranking page which is visible for all roles, in which there are different rankings like ranking based on exp, CorpCoin, top companies, and profit/loss companies.

If any ai service failed and did not respond, all things are waiting in queue.
