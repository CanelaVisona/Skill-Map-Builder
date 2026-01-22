--
-- PostgreSQL database dump
--


-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE ONLY public.skills DROP CONSTRAINT skills_project_id_projects_id_fk;
ALTER TABLE ONLY public.skills DROP CONSTRAINT skills_area_id_areas_id_fk;
ALTER TABLE ONLY public.sessions DROP CONSTRAINT sessions_user_id_users_id_fk;
ALTER TABLE ONLY public.projects DROP CONSTRAINT projects_user_id_users_id_fk;
ALTER TABLE ONLY public.profile_values DROP CONSTRAINT profile_values_user_id_users_id_fk;
ALTER TABLE ONLY public.profile_missions DROP CONSTRAINT profile_missions_user_id_users_id_fk;
ALTER TABLE ONLY public.profile_likes DROP CONSTRAINT profile_likes_user_id_users_id_fk;
ALTER TABLE ONLY public.profile_about_entries DROP CONSTRAINT profile_about_entries_user_id_users_id_fk;
ALTER TABLE ONLY public.journal_tools DROP CONSTRAINT journal_tools_user_id_users_id_fk;
ALTER TABLE ONLY public.journal_shadows DROP CONSTRAINT journal_shadows_user_id_users_id_fk;
ALTER TABLE ONLY public.journal_places DROP CONSTRAINT journal_places_user_id_users_id_fk;
ALTER TABLE ONLY public.journal_learnings DROP CONSTRAINT journal_learnings_user_id_users_id_fk;
ALTER TABLE ONLY public.journal_characters DROP CONSTRAINT journal_characters_user_id_users_id_fk;
ALTER TABLE ONLY public.areas DROP CONSTRAINT areas_user_id_users_id_fk;
ALTER TABLE ONLY public.users DROP CONSTRAINT users_username_unique;
ALTER TABLE ONLY public.users DROP CONSTRAINT users_pkey;
ALTER TABLE ONLY public.skills DROP CONSTRAINT skills_pkey;
ALTER TABLE ONLY public.sessions DROP CONSTRAINT sessions_pkey;
ALTER TABLE ONLY public.projects DROP CONSTRAINT projects_pkey;
ALTER TABLE ONLY public.profile_values DROP CONSTRAINT profile_values_pkey;
ALTER TABLE ONLY public.profile_missions DROP CONSTRAINT profile_missions_pkey;
ALTER TABLE ONLY public.profile_likes DROP CONSTRAINT profile_likes_pkey;
ALTER TABLE ONLY public.profile_about_entries DROP CONSTRAINT profile_about_entries_pkey;
ALTER TABLE ONLY public.journal_tools DROP CONSTRAINT journal_tools_pkey;
ALTER TABLE ONLY public.journal_shadows DROP CONSTRAINT journal_shadows_pkey;
ALTER TABLE ONLY public.journal_places DROP CONSTRAINT journal_places_pkey;
ALTER TABLE ONLY public.journal_learnings DROP CONSTRAINT journal_learnings_pkey;
ALTER TABLE ONLY public.journal_characters DROP CONSTRAINT journal_characters_pkey;
ALTER TABLE ONLY public.areas DROP CONSTRAINT areas_pkey;
DROP TABLE public.users;
DROP TABLE public.skills;
DROP TABLE public.sessions;
DROP TABLE public.projects;
DROP TABLE public.profile_values;
DROP TABLE public.profile_missions;
DROP TABLE public.profile_likes;
DROP TABLE public.profile_about_entries;
DROP TABLE public.journal_tools;
DROP TABLE public.journal_shadows;
DROP TABLE public.journal_places;
DROP TABLE public.journal_learnings;
DROP TABLE public.journal_characters;
DROP TABLE public.areas;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areas (
    id character varying NOT NULL,
    name text NOT NULL,
    icon text NOT NULL,
    color text NOT NULL,
    description text NOT NULL,
    unlocked_level integer DEFAULT 1 NOT NULL,
    next_level_to_assign integer DEFAULT 1 NOT NULL,
    level_subtitles jsonb DEFAULT '{}'::jsonb NOT NULL,
    user_id character varying,
    archived integer DEFAULT 0
);


--
-- Name: journal_characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_characters (
    id character varying NOT NULL,
    user_id character varying,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    image_url text,
    action text DEFAULT ''::text NOT NULL
);


--
-- Name: journal_learnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_learnings (
    id character varying NOT NULL,
    user_id character varying,
    title text NOT NULL,
    sentence text DEFAULT ''::text NOT NULL
);


--
-- Name: journal_places; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_places (
    id character varying NOT NULL,
    user_id character varying,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    image_url text,
    action text DEFAULT ''::text NOT NULL
);


--
-- Name: journal_shadows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_shadows (
    id character varying NOT NULL,
    user_id character varying,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    image_url text,
    action text DEFAULT ''::text NOT NULL,
    defeated integer DEFAULT 0
);


--
-- Name: journal_tools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_tools (
    id character varying NOT NULL,
    user_id character varying,
    title text NOT NULL,
    sentence text DEFAULT ''::text NOT NULL
);


--
-- Name: profile_about_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_about_entries (
    id character varying NOT NULL,
    user_id character varying,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL
);


--
-- Name: profile_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_likes (
    id character varying NOT NULL,
    user_id character varying,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL
);


--
-- Name: profile_missions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_missions (
    id character varying NOT NULL,
    user_id character varying,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL
);


--
-- Name: profile_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_values (
    id character varying NOT NULL,
    user_id character varying,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id character varying NOT NULL,
    name text NOT NULL,
    icon text NOT NULL,
    description text NOT NULL,
    unlocked_level integer DEFAULT 1 NOT NULL,
    next_level_to_assign integer DEFAULT 1 NOT NULL,
    level_subtitles jsonb DEFAULT '{}'::jsonb NOT NULL,
    user_id character varying,
    archived integer DEFAULT 0,
    quest_type text DEFAULT 'main'::text
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id character varying NOT NULL,
    user_id character varying NOT NULL,
    expires_at timestamp without time zone NOT NULL
);


--
-- Name: skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skills (
    id character varying NOT NULL,
    area_id character varying,
    title text NOT NULL,
    description text NOT NULL,
    status text NOT NULL,
    x integer NOT NULL,co
    y integer NOT NULL,
    dependencies jsonb NOT NULL,
    manual_lock integer DEFAULT 0,
    is_final_node integer DEFAULT 0,
    level integer DEFAULT 1 NOT NULL,
    level_position integer DEFAULT 1 NOT NULL,
    project_id character varying,
    parent_skill_id character varying,
    feedback text DEFAULT ''::text,
    action text DEFAULT ''::text NOT NULL,
    experience_points integer DEFAULT 0
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying NOT NULL,
    username text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    profile_mission text DEFAULT ''::text,
    profile_values text DEFAULT ''::text,
    profile_likes text DEFAULT ''::text,
    profile_about text DEFAULT ''::text
);


--
-- Data for Name: areas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.areas (id, name, icon, color, description, unlocked_level, next_level_to_assign, level_subtitles, user_id, archived) FROM stdin;
meditacin	Meditación	Dumbbell	text-zinc-800 dark:text-zinc-200	Aumentá tus habilidades de percepción y aumentá tu capacidad para tomar el control de tu propio cuerpo y entrar en flow	1	1	{}	f8adec74-bf8c-45ca-aca5-45b0896cafae	0
house	Casa	Home	text-zinc-800 dark:text-zinc-200	Mantenimiento, cocina y organización.	1	1	{"1": ""}	\N	0
football	Fútbol	Trophy	text-zinc-800 dark:text-zinc-200	Técnica, físico y táctica.	2	2	{}	\N	0
casa_limpia	Casa	Home	text-zinc-800 dark:text-zinc-200	Tu base está en caos. Objetos fuera de lugar, polvo acumulado y energía estancada afectan tu concentración y tu ánimo.\nTu misión es restaurar el equilibrio del hogar y convertirlo en un espacio funcional y habitable otra vez.	1	1	{}	f8adec74-bf8c-45ca-aca5-45b0896cafae	0
ftbol	Fútbol	Dumbbell	text-zinc-800 dark:text-zinc-200		1	1	{}	f8adec74-bf8c-45ca-aca5-45b0896cafae	0
msica	Música	Music	text-zinc-800 dark:text-zinc-200	Desarrollá tu oído, tu técnica y tu sentido del ritmo. Este camino te guía a entender cómo funciona la música y a expresarte con tu instrumento.	2	2	{"1": "Diapasón expert", "2": "Las agudas"}	f8adec74-bf8c-45ca-aca5-45b0896cafae	0
e8f56f74-8263-4425-98b3-c424fb251db3	Ejemplo: Guitarra	Music	#3B82F6	Esta es un área de ejemplo. Mantén presionado para ver opciones.	1	1	{}	08e66067-455d-4c30-9b72-3207814484b3	0
ea23a542-0b32-4f92-88e2-1c436b3b7445	Ejemplo: Guitarra	Music	#3B82F6	Esta es un área de ejemplo. Mantén presionado para ver opciones.	1	1	{}	b714848c-4c0d-413f-a97e-824f99c5cd2a	0
literature	Literatura	BookOpen	text-zinc-800 dark:text-zinc-200	Lectura crítica y escritura creativa.	4	4	{"1": ""}	\N	0
5e041685-7fc3-4eda-8974-a3af7c794dc9	Ejemplo: Guitarra	Music	#3B82F6	Esta es un área de ejemplo. Mantén presionado para ver opciones.	1	1	{}	9ef95abf-ca27-4e2c-84c5-649030a719a9	0
c97eb9d2-f283-4b8e-9be4-6eb5c3008217	Ejemplo: Guitarra	Music	#3B82F6	Esta es un área de ejemplo. Mantén presionado para ver opciones.	1	1	{}	b64e96cf-c338-4e1f-aa91-efacf58deddf	0
guitar	Guitarra	Music	text-zinc-800 dark:text-zinc-200	Dominio del instrumento y teoría musical.	1	1	{}	\N	0
finanzas	Finanzas	FolderKanban	text-zinc-800 dark:text-zinc-200	Aprendé a gestionar cada vez mejor el dinero que recibís y usás para crecer en tus metas.	2	2	{"1": "Modo de ver el dinero", "2": "Registrar gastos"}	f8adec74-bf8c-45ca-aca5-45b0896cafae	0
escribir	Escribir	BookOpen	text-zinc-800 dark:text-zinc-200	Mejorá tus habilidades escribiendo cada vez más con tu propio estilo y descubriendo nuevas formas de expresar la realidad.	1	1	{"1": "Sueños"}	f8adec74-bf8c-45ca-aca5-45b0896cafae	0
social	Social	Heart	text-zinc-800 dark:text-zinc-200	Mejorá tus habilidades sociales y tu capacidad de comunicarte y leer situaciones.	1	1	{"1": "Ensayar formas de asertividad"}	f8adec74-bf8c-45ca-aca5-45b0896cafae	0
viajar	Viajar	Briefcase	text-zinc-800 dark:text-zinc-200	Aprendé a adentrarte en nuevos lugares con street smart	2	2	{"1": "Mendoza por navidad", "2": "Surfear en el verano"}	f8adec74-bf8c-45ca-aca5-45b0896cafae	0
\.


--
-- Data for Name: journal_characters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.journal_characters (id, user_id, name, description, image_url, action) FROM stdin;
1d3f6e14-6937-4def-b557-da5d10223fe8	f8adec74-bf8c-45ca-aca5-45b0896cafae	FIRLA	Me da amor. La busco por todos lados y es un lugar parecido al hogar.	\N	
c3786655-9fea-4eb1-ba27-908a369bcf25	08e66067-455d-4c30-9b72-3207814484b3	MI MENTOR	Alguien que me inspira y me guía. Puede ser real o imaginario. Aquí puedo escribir qué admiro de esta persona y qué quiero aprender.	\N	Escuchar y aprender
0af7e000-b1ff-4fc1-bb81-5405a501cca6	b714848c-4c0d-413f-a97e-824f99c5cd2a	MI MENTOR	Alguien que me inspira y me guía. Puede ser real o imaginario. Aquí puedo escribir qué admiro de esta persona y qué quiero aprender.	\N	Escuchar y aprender
32af2150-7d30-4f58-927a-c4e2ea00f403	b64e96cf-c338-4e1f-aa91-efacf58deddf	MAMÁ	NPC aliado. Siempre tiene items de curación disponibles. Misión secundaria: llamarla una vez por semana.	\N	
218068a6-2247-4533-90cd-9e314a52ed9c	9ef95abf-ca27-4e2c-84c5-649030a719a9	MAMÁ	NPC aliado. Siempre tiene items de curación disponibles. Misión secundaria: llamarla una vez por semana.	\N	
\.


--
-- Data for Name: journal_learnings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.journal_learnings (id, user_id, title, sentence) FROM stdin;
cf672558-6120-4d3b-94f3-eb49a33685f6	f8adec74-bf8c-45ca-aca5-45b0896cafae	GITHUB COPILOT	Aprendí que hay una extensión de Microsoft que me puede ayudar a editar el código pero que al pasar una carpeta de replit necesito descargar dependencias y pasar "secrets" y demás migraciones que aún desconozco.
bffcbb54-8735-43d5-9b66-6e2104977aba	f8adec74-bf8c-45ca-aca5-45b0896cafae	¿CÓMO ESTAR PRESENTE POR UN TIEMPO PROLONGADO?	Me di cuenta que no se trata de mantenerse atenta 100% sin distracción y  que era por esa intensidad de atención que me daba cosa que me miren en la calle mirando. Que la atención tiene que fluir entre estar presente observando y sintiendo el mundo exterior y también en pensamientos automáticos y escuchando mis pensamientos y que eso ES estar presente. Así que me relajé y se volvió mucho más interesante y divertido estar presente mientras camino.
\.


--
-- Data for Name: journal_places; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.journal_places (id, user_id, name, description, image_url, action) FROM stdin;
822b83ec-c8df-4612-9ad2-29abf1319b96	f8adec74-bf8c-45ca-aca5-45b0896cafae	CASA	Llegar a ella a veces puede ser una travesía pero al estar adentro todo está en paz. Hay silencio y puedo ver el cielo desde el sillón.	\N	
35268805-4ae6-43ba-980f-4efaaea48b8c	08e66067-455d-4c30-9b72-3207814484b3	MI ESPACIO DE PAZ	Un lugar donde me siento en calma. Puede ser físico o mental. Describo cómo es, qué sensaciones me produce y por qué es especial para mí.	\N	Respirar y recargar energía
edce7b4d-c40f-4245-9356-85156c01db05	b714848c-4c0d-413f-a97e-824f99c5cd2a	MI ESPACIO DE PAZ	Un lugar donde me siento en calma. Puede ser físico o mental. Describo cómo es, qué sensaciones me produce y por qué es especial para mí.	\N	Respirar y recargar energía
b42faec6-8822-496c-a136-564f3d56ed3c	b64e96cf-c338-4e1f-aa91-efacf58deddf	CAFÉ DE LA ESQUINA	Zona segura. Ideal para farmear concentración. El café con leche otorga +20 energía por 2 horas.	\N	
53853897-69a1-4f1b-a388-3a7a0853327d	9ef95abf-ca27-4e2c-84c5-649030a719a9	CAFÉ DE LA ESQUINA	Zona segura. Ideal para farmear concentración. El café con leche otorga +20 energía por 2 horas.	\N	
\.


--
-- Data for Name: journal_shadows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.journal_shadows (id, user_id, name, description, image_url, action, defeated) FROM stdin;
9ee15b00-4948-4775-9b50-769c48e7d24b	08e66067-455d-4c30-9b72-3207814484b3	EL PERFECCIONISMO	Una sombra es algo que me limita o me frena. Aquí puedo explorar mis miedos, dudas o patrones negativos. Escribir sobre ellos me ayuda a entenderlos y eventualmente vencerlos.	\N	Reconocer y soltar	0
272ce4f0-e790-44df-bbe6-ff0518d45686	b714848c-4c0d-413f-a97e-824f99c5cd2a	EL PERFECCIONISMO	Una sombra es algo que me limita o me frena. Aquí puedo explorar mis miedos, dudas o patrones negativos. Escribir sobre ellos me ayuda a entenderlos y eventualmente vencerlos.	\N	Reconocer y soltar	0
09d90e2f-609a-42e4-a473-72adce36be76	b64e96cf-c338-4e1f-aa91-efacf58deddf	PROCRASTINACIÓN	Boss recurrente. Aparece cuando hay deadlines cerca. Debilidad: dividir tareas en pasos pequeños. Drop rate de culpa: 80%.	\N		0
53089ef7-a6aa-4020-89a6-e0c4f3f6e4ef	9ef95abf-ca27-4e2c-84c5-649030a719a9	PROCRASTINACIÓN	Boss recurrente. Aparece cuando hay deadlines cerca. Debilidad: dividir tareas en pasos pequeños. Drop rate de culpa: 80%.	\N		0
39c5f2bc-5251-42c0-be78-de8e57d1ef43	f8adec74-bf8c-45ca-aca5-45b0896cafae	VANITATIS	Esta sombra la conozco JA.... nunca pensé que persistiría por tanto tiempo. Busca denigrarme, achicarme, mantenerme chiquita con su supuesta grandeza y poder. Le gusta mostrar que tiene dinero y que con eso valdrá más que cualquier otra persona que no lo admire. ¿Miedo? Sí, le tengo. Tengo miedo a que se integre a mí y me haga igual que ella.	\N		0
64b07e02-5ba1-4c35-9a81-9c58d36b39ce	f8adec74-bf8c-45ca-aca5-45b0896cafae	ODIUM	Esta sombra intenta traspasar los límites de mi integridad para imponer una forma de ser que no contempla cómo me siento o podría sentirme. Quiere imponer sin escuchar, sin mirar, sin contemplar. Golpea y odia para que las cosas se hagan como la sombra quiere que se hagan. Ignora a quien lo respeta para enfocarse en quien odia y cree que debe "enderezar" con insultos y castigos. Busca quebrar la integridad del jugador para que actúe según sus reglas.\n\nPeligro:\nSi te acercás demasiado, empieza a susurrar insultos que buscan enderezarte a la fuerza. Te hace creer que tu manera de sentir o actuar está mal.\n\nDebilidad:\nSe desvanece cuando el jugador pone un límite claro o reconoce sus propias emociones.	\N		0
\.


--
-- Data for Name: journal_tools; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.journal_tools (id, user_id, title, sentence) FROM stdin;
211dbc78-ec3e-447d-aae2-6bc013de5455	f8adec74-bf8c-45ca-aca5-45b0896cafae	ROLEPLAY	Escirbir como si fuese que estés dando una clase increible. Después podés cambiar el registro pero al inspirarte podés simularlo porque es más divertido.
08a45f21-4bcb-4490-b824-944052ec8364	f8adec74-bf8c-45ca-aca5-45b0896cafae	TURN TO THE MASTER ROL	No pares en todo lo que crees que podría estar mal. Dejate fluir sabiendo que después vas a volver a esos puntos. No es esto el resultado que vas a entregar sino el resultado final de esta fase. Si solo tomás el rol de crítica cortás el flujo. Ahora  es el rol de oradora.
1bed7ad4-b006-4386-bdc5-b6800cdc145b	f8adec74-bf8c-45ca-aca5-45b0896cafae	FINGIR DEMENCIA Y SEGUÍ	Chequear constantemente la información  desvía. Fingí demencia. Subirte al tren es más importante que tener razón.
\.


--
-- Data for Name: profile_about_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profile_about_entries (id, user_id, name, description) FROM stdin;
\.


--
-- Data for Name: profile_likes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profile_likes (id, user_id, name, description) FROM stdin;
8a28f641-f0ad-4960-a40f-0d79175aad84	f8adec74-bf8c-45ca-aca5-45b0896cafae	ME GUSTA LOS ACORDES MAJ7	El sonido de los acordes chill
958167f5-c599-4d76-81bb-68887c77f43a	f8adec74-bf8c-45ca-aca5-45b0896cafae	ME GUSTA LA LECHUGA	La lechuga condimentada me fascina desde chica
c9c71bc9-0ef5-4f11-92a4-8cfd8706de68	f8adec74-bf8c-45ca-aca5-45b0896cafae	ME MOLESTA LA INCONGRUENCIA	No me gusta cuando alguien habla mal de otra persona con otros pero no se lo dice a esa persona de quien habla
923c1365-77c2-4671-b11d-6a6d48f032a8	f8adec74-bf8c-45ca-aca5-45b0896cafae	VER REIR A MI NOVIA	Se le achinan los ojos y se los dejo de ver
\.


--
-- Data for Name: profile_missions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profile_missions (id, user_id, name, description) FROM stdin;
\.


--
-- Data for Name: profile_values; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profile_values (id, user_id, name, description) FROM stdin;
b87f97bb-61e2-4002-b9c1-7655e520940b	f8adec74-bf8c-45ca-aca5-45b0896cafae	TRATAR BIEN	Esforzarse por tratar bien aunque te sientas frustrada y angustiada. Aunque la otra persona tenga menos poder que vos.
b5bc3f14-6498-4f39-9a35-6b3b64a6d357	f8adec74-bf8c-45ca-aca5-45b0896cafae	SOLIDARIDAD	Compartir lo que sabés que al otro le puede ayudar
9c676d23-1549-4dfc-97dc-55fc720f4562	f8adec74-bf8c-45ca-aca5-45b0896cafae	RIQUEZA	La riqueza es para mí\n\nCompartir tiempo con personas que quiero.\n\n- Tener dónde dormir y qué comer.\n\n- Disfrutar lo que tengo.
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, name, icon, description, unlocked_level, next_level_to_assign, level_subtitles, user_id, archived, quest_type) FROM stdin;
alexis_o_el_tratado_del_intil_combate_1765122895277	Alexis o el tratado del inútil combate	Palette		2	2	{}	\N	0	main
viaje_lcdth_1765156297470	Viaje!!! Lcdth	Briefcase		2	2	{}	\N	0	main
alexis_o_el_tratado_del_intil_combate_1765405345491	Alexis o el tratado del inútil combate	BookOpen	Explicá el libro desde una hipótesis de lectura	2	2	{}	f8adec74-bf8c-45ca-aca5-45b0896cafae	1	main
botn_del_bao_1765396404032	Botón del baño	Home	Se rompió misteriosamente el botón de mi baño. Solucionalo para volver a hacer pis.	2	2	{}	f8adec74-bf8c-45ca-aca5-45b0896cafae	1	main
relacin_sana_1767217260261	Relación sana	Heart	Aprendé y sorteá los obstáculos de la vida desarrollando habilidades y conductas para mantener una relación sana con tu pareja.	1	1	{}	f8adec74-bf8c-45ca-aca5-45b0896cafae	0	main
lavadero_1767697136314	Lavadero	Home	Tu lavadero tiene burbujas de humedad. Llamá al contratista para que venga a arreglarlo.	1	1	{}	f8adec74-bf8c-45ca-aca5-45b0896cafae	0	side
lanzar_mi_app_1765465891458	Lanzar mi app	Code	Te das cuenta de que tus métodos actuales no te alcanzan para aprender de forma fluida. Querés crear una interfaz que te ayude a estudiar mejor, pero no dominás todas las herramientas aún. Si te metés de lleno ahora, este proyecto puede ser el salto que necesitás para desarrollar tus habilidades de programación	4	4	{}	f8adec74-bf8c-45ca-aca5-45b0896cafae	0	main
063b2f26-f2f1-409a-97e1-f45092e2db89	Ejemplo: Viaje a Barcelona	Camera	Un proyecto tiene fecha de fin. ¡Planifica tu próximo viaje!	1	1	{}	08e66067-455d-4c30-9b72-3207814484b3	0	main
a5cb63d6-d46c-433d-921f-fde2a3fb5fec	Ejemplo: Viaje a Barcelona	Camera	Un proyecto tiene fecha de fin. ¡Planifica tu próximo viaje!	1	1	{}	b714848c-4c0d-413f-a97e-824f99c5cd2a	0	main
a4457b87-0ee1-40a0-95e3-c7a812298be7	Ejemplo: Viaje a Barcelona	Camera	Un proyecto tiene fecha de fin. ¡Planifica tu próximo viaje!	1	1	{}	9ef95abf-ca27-4e2c-84c5-649030a719a9	0	main
e18cbd16-6c86-432e-a61e-dedd623f87ce	Ejemplo: Viaje a Barcelona	Camera	Un proyecto tiene fecha de fin. ¡Planifica tu próximo viaje!	1	1	{}	b64e96cf-c338-4e1f-aa91-efacf58deddf	0	main
leer_literatura_argentina_1768053900543	Leer literatura argentina	BookOpen	Envolvete en la historia argentina y la literatura de tu tierra	1	1	{}	f8adec74-bf8c-45ca-aca5-45b0896cafae	0	main
humedad_1765571174968	Humedad	Home	En tu casa hay una pared de humedad. Resolvé el conflicto antes de que se intensifique el problema.	1	1	{}	f8adec74-bf8c-45ca-aca5-45b0896cafae	0	side
alimentacin_1765883187549	Alimentación	Utensils	Ahora tu cuerpo no está lo suficientemente fuerte para hacer todas las actividades. Fortalécelo para poder tener más agilidad y energía.	1	1	{}	f8adec74-bf8c-45ca-aca5-45b0896cafae	0	main
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, user_id, expires_at) FROM stdin;
c3ce964d-af86-4eaf-bacc-2c5c051408ea	f8adec74-bf8c-45ca-aca5-45b0896cafae	2026-01-08 03:44:12.034
c83d75a9-598b-4220-97eb-44730b67cd03	f8adec74-bf8c-45ca-aca5-45b0896cafae	2026-01-08 12:40:47.732
cb6e5618-9dd9-47c8-86cf-42f56d024756	f8adec74-bf8c-45ca-aca5-45b0896cafae	2026-01-09 19:51:52.972
7f09d95c-610d-4b89-acec-026dbd13f0a0	f8adec74-bf8c-45ca-aca5-45b0896cafae	2026-02-09 03:03:34.205
d6507a1a-bc8c-4a1a-ac39-48aa2512eb8e	f8adec74-bf8c-45ca-aca5-45b0896cafae	2026-02-09 12:37:40.095
\.


--
-- Data for Name: skills; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.skills (id, area_id, title, description, status, x, y, dependencies, manual_lock, is_final_node, level, level_position, project_id, parent_skill_id, feedback, action, experience_points) FROM stdin;
8d21f8fb-e28e-4d5b-9e3d-919ab22bf22b	\N	?		mastered	50	1600	[]	0	0	3	1	\N	d44a4600-43b6-474e-b898-c217fb852f9a			0
thsmxp2rm	\N	inicio		available	50	100	[]	0	0	1	1	alexis_o_el_tratado_del_intil_combate_1765122895277	\N			0
cw6fvp81g	\N	?		available	50	700	[]	0	0	2	1	alexis_o_el_tratado_del_intil_combate_1765122895277	\N			0
9bab2229-2a32-4469-94bf-2f86b864669b	\N	?		locked	50	1750	["8d21f8fb-e28e-4d5b-9e3d-919ab22bf22b"]	0	0	3	2	\N	d44a4600-43b6-474e-b898-c217fb852f9a			0
h3	house	?		locked	50	400	["h2"]	1	0	1	3	\N	\N			0
g2	guitar	?		locked	50	250	["g1"]	1	0	1	2	\N	\N			0
b746qdosp	\N	?		locked	50	250	["thsmxp2rm"]	1	0	1	3	alexis_o_el_tratado_del_intil_combate_1765122895277	\N			0
7jxlukc93	\N	inicio		mastered	50	100	[]	0	0	1	1	viaje_lcdth_1765156297470	\N			0
5mirghl9l	\N	Llamar colegio médicos Luján 	Averiguar matrícula provincial si pueden hacerlo en Luján y yo vuelvo y le pido a la tipa que firma con matrícula provincial y me lo hacen rápido presencial en lujan	locked	50	550	["5mirghl9l"]	1	0	1	3	viaje_lcdth_1765156297470	\N			0
1taidncqi	\N	?		locked	50	400	["b746qdosp"]	0	0	1	4	alexis_o_el_tratado_del_intil_combate_1765122895277	\N			0
g5	guitar	?		available	50	700	["g4"]	0	1	1	5	\N	\N			0
xudwxs1pp	guitar	?		locked	50	1300	["xthhezk6w"]	0	0	2	4	\N	\N			0
xthhezk6w	guitar	?		locked	50	1150	["xrjsc9o83"]	0	0	2	3	\N	\N			0
8vr14nyb9	\N	Cambio domicilio Italia 	Escáñese formulario\nAdjuntar con denis y dec jurada\nSubir	available	50	250	["7jxlukc93"]	0	0	1	2	viaje_lcdth_1765156297470	\N			0
wyayh49xi	guitar	?		locked	50	850	[]	0	0	2	1	\N	\N			0
zp6jdtvd5	guitar	?		locked	50	1450	["xudwxs1pp"]	0	1	2	5	\N	\N			0
xrjsc9o83	guitar	?		locked	50	1000	["wyayh49xi"]	0	0	2	2	\N	\N			0
qign5x7kr	\N	?		available	50	550	["1taidncqi"]	0	1	1	5	alexis_o_el_tratado_del_intil_combate_1765122895277	\N			0
la0ong0iz	\N	?		available	50	850	[]	0	0	2	1	viaje_lcdth_1765156297470	\N			0
4nhbusk1s	\N	?		locked	50	850	["cw6fvp81g"]	0	0	2	2	alexis_o_el_tratado_del_intil_combate_1765122895277	\N			0
ydpfzol7w	\N	?		locked	50	1150	["u0d04r1bk"]	0	0	2	4	alexis_o_el_tratado_del_intil_combate_1765122895277	\N			0
u0d04r1bk	\N	?		locked	50	1000	["4nhbusk1s"]	0	0	2	3	alexis_o_el_tratado_del_intil_combate_1765122895277	\N			0
pf6b96bop	\N	?		locked	50	1300	["ydpfzol7w"]	0	1	2	5	alexis_o_el_tratado_del_intil_combate_1765122895277	\N			0
4yosnj595	\N	inicio		available	50	100	[]	0	0	1	1	\N	f1			0
mxxdts02u	football	?		locked	50	1450	["yajdrpa9l"]	0	0	2	5	\N	\N			0
f5	football	?		available	50	1150	[null]	0	1	1	8	\N	\N			0
fhysdioue	football	?		available	50	400	["f2"]	0	0	1	3	\N	\N			0
f4	football	?		locked	50	700	["f3"]	0	0	1	5	\N	\N			0
3dsrahvba	football	?		locked	50	1750	["zm1pjh3u5"]	0	0	2	7	\N	\N			0
bz3c2t0d0	football	?		locked	50	1900	["3dsrahvba"]	0	1	2	8	\N	\N			0
f3	football	?		available	50	550	["f2"]	0	0	1	4	\N	\N			0
g1	guitar	Inicio		mastered	50	100	[]	0	0	1	1	\N	\N			0
l4	literature	?		mastered	50	550	["l3"]	0	0	1	4	\N	\N			0
h1	house	Inicio		available	50	100	[]	0	0	1	1	\N	\N			0
msi0d0r6v	\N	?		locked	50	250	["4yosnj595"]	0	0	1	2	\N	f1			0
4ja8lpwtr	\N	?		locked	50	400	["msi0d0r6v"]	0	0	1	3	\N	f1			0
qi4x63h94	\N	?		locked	50	700	["y7qzntynb"]	1	1	1	5	viaje_lcdth_1765156297470	\N			0
lh7f5yva5	\N	inicio		available	50	100	[]	0	0	1	1	\N	8vr14nyb9			0
7zmgxdm81	\N	?		locked	50	1150	["tiz8og23m"]	0	0	2	3	viaje_lcdth_1765156297470	\N			0
tiz8og23m	\N	?		locked	50	1000	["la0ong0iz"]	0	0	2	2	viaje_lcdth_1765156297470	\N			0
k7cn2il81	\N	?		locked	50	1300	["7zmgxdm81"]	0	0	2	4	viaje_lcdth_1765156297470	\N			0
y7qzntynb	\N	 Turno Ágata Fernandez		locked	50	400	["8vr14nyb9"]	1	0	1	4	viaje_lcdth_1765156297470	\N			0
l5	literature	?		mastered	50	700	["l4"]	0	0	1	6	\N	\N			0
7zga58nqn	literature	?		mastered	50	1150	["p6p9zhmy9"]	0	0	2	3	\N	\N			0
g3	guitar	?		locked	50	400	["g2"]	0	0	1	3	\N	\N			0
g4	guitar	?		locked	50	550	["g3"]	0	0	1	4	\N	\N			0
h4	house	?		locked	50	550	["h3"]	0	0	1	4	\N	\N			0
h5	house	?		locked	50	700	["h4"]	0	1	1	5	\N	\N			0
o1j7vlozf	\N	?		locked	50	250	["lh7f5yva5"]	0	0	1	2	\N	8vr14nyb9			0
cqbam18fx	\N	?		locked	50	400	["o1j7vlozf"]	0	0	1	3	\N	8vr14nyb9			0
814g6e1kl	\N	?		locked	50	550	["cqbam18fx"]	0	0	1	4	\N	8vr14nyb9			0
5l9s9aihk	\N	?		locked	50	700	["814g6e1kl"]	0	1	1	5	\N	8vr14nyb9			0
l2	literature	?		mastered	50	250	["l1"]	0	0	1	2	\N	\N			0
zm1pjh3u5	football	?		locked	50	1600	["mxxdts02u"]	0	0	2	6	\N	\N			0
4ung7ja4g	\N	?		locked	50	1450	["k7cn2il81"]	0	0	2	5	viaje_lcdth_1765156297470	\N			0
ktulw7na7	\N	?		locked	50	550	["4ja8lpwtr"]	1	0	1	4	\N	f1			0
p6p9zhmy9	literature	?		mastered	50	1000	["cz7dx59yw"]	0	0	2	2	\N	\N			0
uyxmhyybo	literature	?		mastered	50	1450	["782faiew4"]	0	0	2	5	\N	\N			0
f1	football	Inicio		available	50	100	[]	0	0	1	1	\N	\N			0
oxwoi1loe	\N	?		available	50	700	["ktulw7na7"]	0	1	1	5	\N	f1			0
f2	football	?		mastered	50	250	["f1"]	0	0	1	2	\N	\N			0
yajdrpa9l	football	?		available	50	1300	[]	0	0	2	4	\N	\N			0
h2	house	?		locked	50	250	["h1"]	1	0	1	2	\N	\N			0
l3	literature	?		mastered	50	400	["l2"]	0	0	1	3	\N	\N			0
l1	literature	Inicio		mastered	50	100	[]	0	0	1	1	\N	\N			0
cz7dx59yw	literature	?		mastered	50	850	[]	0	0	2	1	\N	\N			0
wibe13ka0	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	aq3r69odd			0
5s8agfzxe	\N	inicio		available	50	100	[]	0	0	1	1	\N	h1			0
jh25qfnll	\N	?		locked	50	250	["5s8agfzxe"]	0	0	1	2	\N	h1			0
rirtpssbp	\N	?		locked	50	400	["jh25qfnll"]	0	0	1	3	\N	h1			0
z931lhtkb	\N	?		locked	50	550	["rirtpssbp"]	0	0	1	4	\N	h1			0
bgtd3th26	\N	?		locked	50	700	["z931lhtkb"]	0	1	1	5	\N	h1			0
ofvscsj3f	\N	inicio		available	50	100	[]	0	0	1	1	\N	h2			0
kpk9p3thp	\N	?		locked	50	250	["ofvscsj3f"]	0	0	1	2	\N	h2			0
ghw8rubtk	\N	?		locked	50	400	["kpk9p3thp"]	0	0	1	3	\N	h2			0
yc6lktqdh	\N	?		locked	50	550	["ghw8rubtk"]	0	0	1	4	\N	h2			0
qa65ahf03	\N	?		locked	50	700	["yc6lktqdh"]	0	1	1	5	\N	h2			0
n1ayg46xv	\N	inicio		available	50	100	[]	0	0	1	1	\N	y7qzntynb			0
v7qwr163m	\N	?		locked	50	250	["n1ayg46xv"]	0	0	1	2	\N	y7qzntynb			0
b3fhao1cu	\N	?		locked	50	400	["v7qwr163m"]	0	0	1	3	\N	y7qzntynb			0
4xn0lj0si	\N	?		locked	50	550	["b3fhao1cu"]	0	0	1	4	\N	y7qzntynb			0
wo19cjapf	\N	?		locked	50	700	["4xn0lj0si"]	0	1	1	5	\N	y7qzntynb			0
6w060ekmj	\N	?		available	50	850	[]	0	0	2	1	\N	f1			0
wrhci1kd7	\N	?		locked	50	1000	["6w060ekmj"]	0	0	2	2	\N	f1			0
vp4rgxlam	\N	?		locked	50	1150	["wrhci1kd7"]	0	0	2	3	\N	f1			0
89o4r4aq1	\N	?		locked	50	1300	["vp4rgxlam"]	0	0	2	4	\N	f1			0
1lv559esy	\N	?		locked	50	1450	["89o4r4aq1"]	0	1	2	5	\N	f1			0
u45mo6ofa	\N	inicio		available	50	100	[]	0	0	1	1	\N	f2			0
obeu59m6u	\N	?		mastered	50	250	["u45mo6ofa"]	0	0	1	2	\N	f2			0
kmm4vs7t2	\N	?		mastered	50	400	["obeu59m6u"]	0	0	1	3	\N	f2			0
8nnnczjaj	\N	?		mastered	50	550	["kmm4vs7t2"]	0	0	1	4	\N	f2			0
62efrsj1s	\N	?		mastered	50	250	["wibe13ka0"]	0	0	1	2	\N	aq3r69odd			0
649s5p71t	\N	?		mastered	50	400	["62efrsj1s"]	0	0	1	3	\N	aq3r69odd			0
782faiew4	literature	?		mastered	50	1300	["7zga58nqn"]	0	0	2	4	\N	\N			0
kfxzed19g	\N	?		mastered	50	700	["8nnnczjaj"]	0	0	1	5	\N	f2			0
s4h791p48	\N	?		mastered	50	850	[]	0	0	2	1	\N	f2			0
4f39z0mr0	\N	?		mastered	50	550	["649s5p71t"]	0	0	1	4	\N	aq3r69odd			0
mqsc8jwy6	\N	?		mastered	50	1000	["s4h791p48"]	0	0	2	2	\N	f2			0
o6jp9in04	\N	?		mastered	50	1150	["mqsc8jwy6"]	0	0	2	3	\N	f2			0
vvlgutim2	\N	?		mastered	50	1300	["o6jp9in04"]	0	0	2	4	\N	f2			0
3bxaxbigu	\N	?		mastered	50	700	["4f39z0mr0"]	0	1	1	5	\N	aq3r69odd			0
1jr4n4ex3	literature	?		mastered	50	2200	["qyoknux52"]	0	0	3	5	\N	\N			0
uvrntg7gk	\N	?		mastered	50	1450	["vvlgutim2"]	0	1	2	5	\N	f2			0
4hqxgmr3e	\N	?		available	50	1600	[]	0	0	3	1	\N	f2			0
sffqebyf6	\N	?		locked	50	1750	["4hqxgmr3e"]	0	0	3	2	\N	f2			0
ws86masrd	\N	?		locked	50	1900	["sffqebyf6"]	0	0	3	3	\N	f2			0
mff46bum2	\N	?		locked	50	2050	["ws86masrd"]	0	0	3	4	\N	f2			0
7jj8rgocm	\N	?		locked	50	2200	["mff46bum2"]	0	1	3	5	\N	f2			0
bswh7mniw	literature	?		mastered	50	1600	[]	0	0	3	1	\N	\N			0
662eabe6-6886-4cc3-b455-d62527554852	\N	?		locked	50	1900	["9bab2229-2a32-4469-94bf-2f86b864669b"]	0	0	3	3	\N	d44a4600-43b6-474e-b898-c217fb852f9a			0
0mf1s1l15	\N	?		mastered	50	850	[]	0	0	2	1	\N	aq3r69odd			0
dlakih2f8	literature	?		locked	50	2650	["bm4w7uxfy"]	0	0	4	3	\N	\N			0
pkgl644sm	literature	?		locked	50	2800	["dlakih2f8"]	0	0	4	4	\N	\N			0
t5mk37wxk	literature	?		locked	50	2950	["pkgl644sm"]	0	1	4	5	\N	\N			0
1k9kgq6ce	\N	?		mastered	50	1000	["0mf1s1l15"]	0	0	2	2	\N	aq3r69odd			0
91q1oqswe	literature	?		mastered	50	1750	["bswh7mniw"]	0	0	3	2	\N	\N			0
odlw5g97h	\N	?		mastered	50	1150	["1k9kgq6ce"]	0	0	2	3	\N	aq3r69odd			0
22p1t38jj	literature	?		mastered	50	1900	["91q1oqswe"]	0	0	3	3	\N	\N			0
audcee43g	\N	?		mastered	50	1300	["odlw5g97h"]	0	0	2	4	\N	aq3r69odd			0
qyoknux52	literature	?		mastered	50	2050	["22p1t38jj"]	0	0	3	4	\N	\N			0
aq3r69odd	literature	?		mastered	50	2350	[]	0	0	4	1	\N	\N			0
bm4w7uxfy	literature	?		available	50	2500	["aq3r69odd"]	0	0	4	2	\N	\N			0
6aa8d5ed-99aa-42f4-a336-5c39859c5a76	\N	?		locked	50	2050	["662eabe6-6886-4cc3-b455-d62527554852"]	0	0	3	4	\N	d44a4600-43b6-474e-b898-c217fb852f9a			0
t0z2ayapi	\N	?		available	50	1450	["audcee43g"]	0	0	2	5	\N	aq3r69odd			0
f4d5d116-f3cd-407c-ac90-069bbb96f5b6	\N	?		locked	50	2200	["6aa8d5ed-99aa-42f4-a336-5c39859c5a76"]	0	1	3	5	\N	d44a4600-43b6-474e-b898-c217fb852f9a			0
4ad37e29-6b7b-4d93-a176-73249f827fb0	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	01a7a2b2-d8e7-47c7-b1cc-7f2bf656af99			0
1951ff2b-c2fe-4e5f-b047-bb90b0ea8b2e	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	0bea975a-46d9-4333-bfd1-2426b37ae41c			0
34849224-b699-4d6a-92f5-773513ceb0d2	\N	?		mastered	50	400	["a2807ab1-a91e-4ec4-8b28-6ecda23adb58"]	0	0	1	3	\N	0bea975a-46d9-4333-bfd1-2426b37ae41c			0
7c85c735-cd7f-4737-a25a-4cd06d33c932	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	361cd410-40db-4bed-a3bb-23b09b936a6f			0
8a40c53a-d75f-4422-9772-529036cb83f3	\N	?		mastered	50	550	["34849224-b699-4d6a-92f5-773513ceb0d2"]	0	0	1	4	\N	0bea975a-46d9-4333-bfd1-2426b37ae41c			0
dcdde32a-79b6-4142-aecf-265687f5ba2f	\N	?		available	50	250	["7c85c735-cd7f-4737-a25a-4cd06d33c932"]	0	0	1	2	\N	361cd410-40db-4bed-a3bb-23b09b936a6f			0
d7db228c-1f2e-4c43-bfac-d5ae528dcf28	\N	?		locked	50	700	["ffaf1f18-4898-49b7-b5e4-df038740f8a7"]	0	1	1	5	\N	361cd410-40db-4bed-a3bb-23b09b936a6f			0
ffaf1f18-4898-49b7-b5e4-df038740f8a7	\N	?		available	50	550	["1573ebce-d921-4f04-bb0e-6b14e50761a3"]	0	0	1	4	\N	361cd410-40db-4bed-a3bb-23b09b936a6f			0
5d1ad84f-62c8-4648-84c8-fa3c6c8732c8	\N	?		mastered	50	850	[]	0	0	2	1	\N	361cd410-40db-4bed-a3bb-23b09b936a6f			0
f4bb4654-e9de-4cfd-a6d1-cd39a6283ed7	\N	?		locked	50	1000	["5d1ad84f-62c8-4648-84c8-fa3c6c8732c8"]	0	0	2	2	\N	361cd410-40db-4bed-a3bb-23b09b936a6f			0
ed54fa02-6ecd-4bd3-b097-da30af52d4ba	\N	?		locked	50	1150	["f4bb4654-e9de-4cfd-a6d1-cd39a6283ed7"]	0	0	2	3	\N	361cd410-40db-4bed-a3bb-23b09b936a6f			0
40fd0dc4-a1a7-4758-afc1-109d46d7b5a4	\N	?		locked	50	1300	["ed54fa02-6ecd-4bd3-b097-da30af52d4ba"]	0	0	2	4	\N	361cd410-40db-4bed-a3bb-23b09b936a6f			0
723a3b0c-9e25-4441-bdcf-3e712832a1dc	\N	?		locked	50	1450	["40fd0dc4-a1a7-4758-afc1-109d46d7b5a4"]	0	1	2	5	\N	361cd410-40db-4bed-a3bb-23b09b936a6f			0
1573ebce-d921-4f04-bb0e-6b14e50761a3	\N	?		available	50	400	["dcdde32a-79b6-4142-aecf-265687f5ba2f"]	0	0	1	3	\N	361cd410-40db-4bed-a3bb-23b09b936a6f			0
3ac28083-053c-4b6f-b4c1-4f0b0b201bfd	\N	?		mastered	50	700	["8a40c53a-d75f-4422-9772-529036cb83f3"]	0	1	1	5	\N	0bea975a-46d9-4333-bfd1-2426b37ae41c			0
a2807ab1-a91e-4ec4-8b28-6ecda23adb58	\N	?		mastered	50	250	["1951ff2b-c2fe-4e5f-b047-bb90b0ea8b2e"]	0	0	1	2	\N	0bea975a-46d9-4333-bfd1-2426b37ae41c			0
3f1f38d0-626f-4300-9f7e-4c1d038bff06	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	c40be2da-19d6-499b-af70-252726be9924			0
4c1504b3-b7ef-453b-9a15-04432d8dd908	\N	Next challenge		locked	50	250	["3f1f38d0-626f-4300-9f7e-4c1d038bff06"]	0	0	1	2	\N	c40be2da-19d6-499b-af70-252726be9924			0
f9000a8f-f76a-4fdf-b7ee-296fc3584289	\N	Next challenge		locked	50	400	["4c1504b3-b7ef-453b-9a15-04432d8dd908"]	0	0	1	3	\N	c40be2da-19d6-499b-af70-252726be9924			0
39169bad-a146-46d9-9f5f-b290c5ab198a	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	cda1c7b9-2bd1-43d2-9001-200bae9a35d2			0
4ff83878-e2d3-4b20-9e25-5b2ed2069ac1	\N	Next challenge		locked	50	550	["f9000a8f-f76a-4fdf-b7ee-296fc3584289"]	0	0	1	4	\N	c40be2da-19d6-499b-af70-252726be9924			0
43396875-7adf-450d-b398-501649efe93c	\N	Next challenge		locked	50	700	["4ff83878-e2d3-4b20-9e25-5b2ed2069ac1"]	0	1	1	5	\N	c40be2da-19d6-499b-af70-252726be9924			0
d8981ec6-724d-48ec-abb2-7c6f3e872bee	\N	?		locked	50	250	["39169bad-a146-46d9-9f5f-b290c5ab198a"]	0	0	1	2	\N	cda1c7b9-2bd1-43d2-9001-200bae9a35d2			0
4d6ffc3d-0c44-4f82-9e8d-c8541ab3f099	\N	?		locked	50	400	["d8981ec6-724d-48ec-abb2-7c6f3e872bee"]	0	0	1	3	\N	cda1c7b9-2bd1-43d2-9001-200bae9a35d2			0
beea3860-3c11-4857-bebf-b1e7e73a67fa	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	787382b2-646c-4e16-bd48-a62a2f7c14a6			0
1d85950e-3a9f-4541-bbcb-13054bc564f8	\N	?		locked	50	250	["beea3860-3c11-4857-bebf-b1e7e73a67fa"]	0	0	1	2	\N	787382b2-646c-4e16-bd48-a62a2f7c14a6			0
cd65a387-87b5-4c6e-a973-7b60d72d9e04	\N	?		locked	50	400	["1d85950e-3a9f-4541-bbcb-13054bc564f8"]	0	0	1	3	\N	787382b2-646c-4e16-bd48-a62a2f7c14a6			0
b7a61007-f2a4-4eca-949f-05314bb2d317	\N	?		locked	50	550	["cd65a387-87b5-4c6e-a973-7b60d72d9e04"]	0	0	1	4	\N	787382b2-646c-4e16-bd48-a62a2f7c14a6			0
996f70af-0872-4101-90fe-1a6acd9b56e7	\N	?		locked	50	700	["b7a61007-f2a4-4eca-949f-05314bb2d317"]	0	1	1	5	\N	787382b2-646c-4e16-bd48-a62a2f7c14a6			0
20f86511-f27e-481a-8b5b-a9ee879e81f2	\N	?		locked	50	550	["4d6ffc3d-0c44-4f82-9e8d-c8541ab3f099"]	0	0	1	4	\N	cda1c7b9-2bd1-43d2-9001-200bae9a35d2			0
73cdbcfc-7eb2-4ae8-bfc3-16005ccf891d	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	1c21ef24-bd7f-42c9-9929-736c56d645e8			0
b98b9ed9-9936-4819-b920-de122d88b684	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	7bca0653-cbf1-4d20-9ee8-8cefaded436c			0
97547a15-3261-4fac-b0ee-23e538b921e5	\N	?		locked	50	250	["b98b9ed9-9936-4819-b920-de122d88b684"]	0	0	1	2	\N	7bca0653-cbf1-4d20-9ee8-8cefaded436c			0
2316690e-ba61-49d4-bed1-480f459967f9	\N	?		locked	50	400	["97547a15-3261-4fac-b0ee-23e538b921e5"]	0	0	1	3	\N	7bca0653-cbf1-4d20-9ee8-8cefaded436c			0
78fafe52-6439-4138-8c17-8c2f023c5677	\N	?		locked	50	550	["2316690e-ba61-49d4-bed1-480f459967f9"]	0	0	1	4	\N	7bca0653-cbf1-4d20-9ee8-8cefaded436c			0
e4da7279-e3d8-458c-b44c-fc4c32608cf1	\N	?		locked	50	700	["78fafe52-6439-4138-8c17-8c2f023c5677"]	0	1	1	5	\N	7bca0653-cbf1-4d20-9ee8-8cefaded436c			0
1da2aefb-0261-45cb-9c31-b591d4b2465c	\N	?		locked	50	700	["20f86511-f27e-481a-8b5b-a9ee879e81f2"]	0	1	1	5	\N	cda1c7b9-2bd1-43d2-9001-200bae9a35d2			0
d7342341-c70a-4bda-8d09-6c8daf9c74f0	\N	?		locked	50	250	["73cdbcfc-7eb2-4ae8-bfc3-16005ccf891d"]	0	0	1	2	\N	1c21ef24-bd7f-42c9-9929-736c56d645e8			0
d86ff3f9-6d8e-42b0-9ae5-c06a67ffd636	\N	?		locked	50	400	["d7342341-c70a-4bda-8d09-6c8daf9c74f0"]	0	0	1	3	\N	1c21ef24-bd7f-42c9-9929-736c56d645e8			0
504e0773-ea69-4ac8-a8b0-4c894d182f49	\N	?		locked	50	550	["d86ff3f9-6d8e-42b0-9ae5-c06a67ffd636"]	0	0	1	4	\N	1c21ef24-bd7f-42c9-9929-736c56d645e8			0
6735c8e8-bb37-48ca-a363-756a7c14a3c5	\N	?		locked	50	700	["504e0773-ea69-4ac8-a8b0-4c894d182f49"]	0	1	1	5	\N	1c21ef24-bd7f-42c9-9929-736c56d645e8			0
2359e0cb-95b7-443b-83ea-9f173d804214	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	9df76831-a274-4424-a2b8-1d0686bd759a			0
2b66e2a3-d3ac-40be-8e29-2f7e292b7c18	\N	?		mastered	50	250	["2359e0cb-95b7-443b-83ea-9f173d804214"]	0	0	1	2	\N	9df76831-a274-4424-a2b8-1d0686bd759a			0
77a3afa8-2a19-4739-b7a6-1ae649f8d7af	\N	?		mastered	50	400	["2b66e2a3-d3ac-40be-8e29-2f7e292b7c18"]	0	0	1	3	\N	9df76831-a274-4424-a2b8-1d0686bd759a			0
c0f89c3e-aa05-4b33-a1ab-28e802759ce3	\N	?		mastered	50	550	["77a3afa8-2a19-4739-b7a6-1ae649f8d7af"]	0	0	1	4	\N	9df76831-a274-4424-a2b8-1d0686bd759a			0
67ae2362-a12f-4113-b67d-42209b4c0c14	\N	?		mastered	50	700	["c0f89c3e-aa05-4b33-a1ab-28e802759ce3"]	0	1	1	5	\N	9df76831-a274-4424-a2b8-1d0686bd759a			0
484555c5-e56c-4738-96bd-c2be921af232	\N	?		mastered	50	850	[]	0	0	2	1	\N	9df76831-a274-4424-a2b8-1d0686bd759a			0
2c8478c2-114c-4e10-b456-35931bb968b6	\N	?		locked	50	1000	["484555c5-e56c-4738-96bd-c2be921af232"]	0	0	2	2	\N	9df76831-a274-4424-a2b8-1d0686bd759a			0
411ee02b-fe41-4792-83c2-922c45a8bb94	\N	?		locked	50	1150	["2c8478c2-114c-4e10-b456-35931bb968b6"]	0	0	2	3	\N	9df76831-a274-4424-a2b8-1d0686bd759a			0
2cee6a23-54d3-415a-86c4-42f8094454a7	\N	?		locked	50	1300	["411ee02b-fe41-4792-83c2-922c45a8bb94"]	0	0	2	4	\N	9df76831-a274-4424-a2b8-1d0686bd759a			0
6d8811d2-f503-4096-ae79-ff6d4db76287	\N	?		locked	50	1450	["2cee6a23-54d3-415a-86c4-42f8094454a7"]	0	1	2	5	\N	9df76831-a274-4424-a2b8-1d0686bd759a			0
a1aba491-180b-4e2a-a2b8-5a4f4e1d3fc7	finanzas	inicio		mastered	50	100	[]	0	0	1	1	\N	\N			0
ea51cf51-8f75-47e0-81a9-71bcb75283d5	msica	Cuerda 4ta		mastered	50	700	["4c3bc701-0578-4b0a-b5a7-daf57b1a766b"]	0	0	1	6	\N	\N			0
a8c48bee-1ac5-44fc-b1f1-05d364090ec8	\N	?		mastered	50	250	["c8a35f75-5454-406e-b9db-2b06512af8b0"]	0	0	1	2	\N	1ec75c46-4258-42f6-9fd1-e843fa36ec9e			0
31494dc8-a0a5-445a-8ee7-5b9d3b17179a	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	d44a4600-43b6-474e-b898-c217fb852f9a			0
96005cce-c769-4ba3-84c7-c5e0a50f14da	\N	?		mastered	50	250	["31494dc8-a0a5-445a-8ee7-5b9d3b17179a"]	0	0	1	2	\N	d44a4600-43b6-474e-b898-c217fb852f9a			0
240827a7-910d-425b-8e5f-078dc60b9217	\N	?		mastered	50	400	["96005cce-c769-4ba3-84c7-c5e0a50f14da"]	0	0	1	3	\N	d44a4600-43b6-474e-b898-c217fb852f9a			0
0a92a393-5686-4d3c-bf47-f291a8bfbc99	\N	?		mastered	50	550	["240827a7-910d-425b-8e5f-078dc60b9217"]	0	0	1	4	\N	d44a4600-43b6-474e-b898-c217fb852f9a			0
219be47f-a64d-4bca-8ca3-c73bbfe73353	\N	?		mastered	50	700	["0a92a393-5686-4d3c-bf47-f291a8bfbc99"]	0	1	1	5	\N	d44a4600-43b6-474e-b898-c217fb852f9a			0
aac0102d-4d1d-4eed-9044-e1cde3bda2be	\N	?		mastered	50	850	[]	0	0	2	1	\N	d44a4600-43b6-474e-b898-c217fb852f9a			0
8d40c1c1-20fd-497c-b2c5-0abdf9f82ec6	\N	?		mastered	50	1000	["aac0102d-4d1d-4eed-9044-e1cde3bda2be"]	0	0	2	2	\N	d44a4600-43b6-474e-b898-c217fb852f9a			0
56a7288f-3f4f-4435-b508-9ce22c51f94f	\N	?		mastered	50	1150	["8d40c1c1-20fd-497c-b2c5-0abdf9f82ec6"]	0	0	2	3	\N	d44a4600-43b6-474e-b898-c217fb852f9a			0
a34b991f-5a44-42ff-b7a6-79464cf4ed4f	\N	?		mastered	50	1300	["56a7288f-3f4f-4435-b508-9ce22c51f94f"]	0	0	2	4	\N	d44a4600-43b6-474e-b898-c217fb852f9a			0
b380b43b-ee65-423a-a158-b2bc09cd7e38	\N	?		mastered	50	1450	["a34b991f-5a44-42ff-b7a6-79464cf4ed4f"]	0	1	2	5	\N	d44a4600-43b6-474e-b898-c217fb852f9a			0
d5f5b9d1-7be0-473d-a56f-571e9080a59a	\N	?		mastered	50	400	["a8c48bee-1ac5-44fc-b1f1-05d364090ec8"]	0	0	1	3	\N	1ec75c46-4258-42f6-9fd1-e843fa36ec9e			0
77de51e3-0b92-4067-b2dc-14116faa23ff	\N	?		mastered	50	550	["d5f5b9d1-7be0-473d-a56f-571e9080a59a"]	0	0	1	4	\N	1ec75c46-4258-42f6-9fd1-e843fa36ec9e			0
29aad101-618c-4138-9790-0d0bbfb7f7d5	\N	?		mastered	50	700	["77de51e3-0b92-4067-b2dc-14116faa23ff"]	0	1	1	5	\N	1ec75c46-4258-42f6-9fd1-e843fa36ec9e			0
70409117-a4ad-44f5-a5dd-cbbe60472190	\N	?		mastered	50	850	[]	0	0	2	1	\N	1ec75c46-4258-42f6-9fd1-e843fa36ec9e			0
da26f572-3789-431d-8242-0e6cdb18d659	finanzas	Cuadernillo Honda 1	Responder las preguntas del cuadernillo	mastered	50	250	["a1aba491-180b-4e2a-a2b8-5a4f4e1d3fc7"]	0	0	1	2	\N	\N			0
82f4135e-b21b-453c-98e6-e0fb18fec47e	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	trip-skill-4			0
1d710ca2-ee91-4197-9b2e-332a8449f75d	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	f684fd64-d695-41fe-be60-2efb6df3b3c8			0
37455ac5-28f8-4d7b-bec1-9c19f84c0880	\N	Next challenge		locked	50	250	["82f4135e-b21b-453c-98e6-e0fb18fec47e"]	0	0	1	2	\N	trip-skill-4			0
337f483b-261b-4e84-aeb8-4eae1097fa4b	\N	Next challenge		locked	50	400	["37455ac5-28f8-4d7b-bec1-9c19f84c0880"]	0	0	1	3	\N	trip-skill-4			0
c8a35f75-5454-406e-b9db-2b06512af8b0	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	1ec75c46-4258-42f6-9fd1-e843fa36ec9e			0
45f80726-1756-4e09-ac15-4966826fe5e9	\N	?		locked	50	1000	["70409117-a4ad-44f5-a5dd-cbbe60472190"]	0	0	2	2	\N	1ec75c46-4258-42f6-9fd1-e843fa36ec9e			0
97c95c4c-14c0-4a07-8477-8e363af525be	\N	?		locked	50	1150	["45f80726-1756-4e09-ac15-4966826fe5e9"]	0	0	2	3	\N	1ec75c46-4258-42f6-9fd1-e843fa36ec9e			0
61e8cd54-66cc-43db-9f76-0418074940e2	\N	?		locked	50	1300	["97c95c4c-14c0-4a07-8477-8e363af525be"]	0	0	2	4	\N	1ec75c46-4258-42f6-9fd1-e843fa36ec9e			0
c4aa120d-0f6c-4144-ab72-c928f293e782	\N	?		locked	50	1450	["61e8cd54-66cc-43db-9f76-0418074940e2"]	0	1	2	5	\N	1ec75c46-4258-42f6-9fd1-e843fa36ec9e			0
47b19312-612e-4b57-9f5b-7fdacfe8f7b9	\N	Next challenge		locked	50	550	["337f483b-261b-4e84-aeb8-4eae1097fa4b"]	0	0	1	4	\N	trip-skill-4			0
e87002cc-76b8-4b07-99f9-1c9cd87d2bc9	\N	Next challenge		locked	50	400	["1e9b3db9-cb1e-43c2-8993-d7447b16d2c3"]	0	1	1	5	\N	trip-skill-2			0
9bfd89a2-d077-425e-a14c-58677abe215a	\N	Limpiar archivos	Limpia el vite.config.ts: Elimina o comenta las líneas que importan @replit/vite-plugin-cartographer y @replit/vite-plugin-dev-banner.	mastered	50	400	["ac89c1ba-a2aa-4243-8f48-6693f04ae8ae"]	0	0	1	3	\N	f684fd64-d695-41fe-be60-2efb6df3b3c8			0
a3155e07-679f-49ea-85cc-2b1ec1723307	\N	Niveles en Canva	Armar los skill trees de A1	mastered	50	1750	["1123ca1d-2f3d-483c-bbd3-f5f2c824a1d1"]	0	0	3	2	lanzar_mi_app_1765465891458	\N			0
41b18f76-c523-4887-9013-9f1987aea23f	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	trip-skill-2			0
7ada31f1-68a6-42a7-8f56-ced9c3bb63f7	finanzas	Diseñar mi lifestyle	Diseñar el estilo de vida que quiero para saber cuánto quiero invertir y no obsesionarme solamente con ganar más más y más	mastered	50	700	["943fa4ea-7a8b-4e63-80a5-b404e85ffd01"]	0	0	1	5	\N	\N			0
943fa4ea-7a8b-4e63-80a5-b404e85ffd01	finanzas	Video Honda 1	Ver los videos de youtube que me parececn atractivos: https://www.youtube.com/watch?v=Lx062tiimes&list=PLVZZbGs5eDeG3vaV0FIFBTv9B8WjNH4nv	mastered	50	400	["da26f572-3789-431d-8242-0e6cdb18d659"]	0	0	1	4	\N	\N			0
6af125d1-a4e8-463b-91a1-b6b821707965	finanzas	Trauma con recibir	Pensar en las sombras que tengo alrededor del concepto del dinero. De las experiencias vividas que vuelven y me impiden recibir con positividad	mastered	50	850	["7ada31f1-68a6-42a7-8f56-ced9c3bb63f7"]	0	0	1	6	\N	\N			0
0bc3e704-8f4e-40fc-8bdf-6b5829a50f69	\N	Next challenge		locked	50	700	["47b19312-612e-4b57-9f5b-7fdacfe8f7b9"]	0	1	1	5	\N	trip-skill-4			0
b2fcd67c-8dd6-4c16-863e-57c2a6a5d010	\N	Ponerme seria	Despues de decir un chiste que se lo toma en serio tirandome un palo tengo que ponerme seria y ser clara con que fue un chiste	available	50	550	["b64678e4-efba-4a30-a969-f1acd99e5549"]	0	0	1	3	relacin_sana_1767217260261	\N			0
1c564bce-d961-48e5-a1e6-095672529ecb	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	819e876a-37f9-4a16-a6b6-f8176b020907			0
c9784056-9f20-4bb6-ae1e-4593c1f357ff	\N	Next challenge		locked	50	250	["1c564bce-d961-48e5-a1e6-095672529ecb"]	0	0	1	2	\N	819e876a-37f9-4a16-a6b6-f8176b020907			0
d8e1438f-0f9a-4270-b204-47c64d46b620	\N	Next challenge		locked	50	400	["c9784056-9f20-4bb6-ae1e-4593c1f357ff"]	0	0	1	3	\N	819e876a-37f9-4a16-a6b6-f8176b020907			0
1e9b3db9-cb1e-43c2-8993-d7447b16d2c3	\N	Next challenge		locked	50	250	["41b18f76-c523-4887-9013-9f1987aea23f"]	0	0	1	4	\N	trip-skill-2			0
34197438-8df1-452d-bba4-eccf53e98575	\N	Next challenge		locked	50	550	["d8e1438f-0f9a-4270-b204-47c64d46b620"]	0	0	1	4	\N	819e876a-37f9-4a16-a6b6-f8176b020907			0
83c9bb68-ae33-4815-9c73-ad6a4dc5cabc	\N	Next challenge		locked	50	700	["34197438-8df1-452d-bba4-eccf53e98575"]	0	1	1	5	\N	819e876a-37f9-4a16-a6b6-f8176b020907			0
58c6327c-5cf9-4a98-92fb-c2e2b463d5ea	msica	4,5,6 cuerdas	Las primeras tres cuedas	mastered	50	1000	["3cf1ace6-0be7-425f-bc9e-43afc24e8958"]	0	0	1	8	\N	\N			0
9b02a347-2841-45f6-b1e4-2f20d3f01a05	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	14046abd-d568-4c26-8c93-54c0ece0f87d			0
7a9bde76-5d8e-4dcc-ada1-8e1ed9bf9210	finanzas	Cuadernillo Honda 2	Responder las preguntas del cuadernillo	mastered	50	550	["da26f572-3789-431d-8242-0e6cdb18d659"]	0	0	1	3	\N	\N			0
3c39bd8e-f780-4a7f-96f0-c9db249f864e	\N	Next challenge		locked	50	550	["94ac4c3c-0465-416c-8146-7fbc8a3ae3fe"]	0	0	1	4	\N	14046abd-d568-4c26-8c93-54c0ece0f87d			0
69d0d122-0db3-4ecd-96df-701658c501f0	\N	Next challenge		locked	50	700	["3c39bd8e-f780-4a7f-96f0-c9db249f864e"]	0	1	1	5	\N	14046abd-d568-4c26-8c93-54c0ece0f87d			0
94ac4c3c-0465-416c-8146-7fbc8a3ae3fe	\N	Next challenge		locked	50	400	["3e8d0171-9110-4aed-882f-a7be82cea642"]	0	0	1	3	\N	14046abd-d568-4c26-8c93-54c0ece0f87d			0
d0ac72d1-70d3-4c5d-8afe-5729c5fd4bbd	escribir	Reflexionar sobre bloqueo	¿Por qué no quiero darme el tiempo para escribir? ¿a qué le tengo miedo?	available	50	400	["eff529ef-4f2a-455e-8aa8-324b54d0cf7a"]	0	0	1	4	\N	\N			0
1a9bf9bb-d44e-47da-a001-0cfdcb2d6db7	\N	Subit el github		mastered	50	550	["1a9bf9bb-d44e-47da-a001-0cfdcb2d6db7"]	0	1	1	4	\N	f684fd64-d695-41fe-be60-2efb6df3b3c8			0
1123ca1d-2f3d-483c-bbd3-f5f2c824a1d1	\N			mastered	50	1600	[]	0	0	3	1	lanzar_mi_app_1765465891458	\N			0
42b826d0-4b16-4754-b7ba-28b063c059ba	viajar			mastered	50	400	[]	0	0	2	1	\N	\N			0
cde585ec-e343-4aac-8090-528f44b33a7d	viajar	Next challenge		locked	50	700	["55d9c1e2-e042-400a-bfec-95a0623eea84"]	0	0	2	3	\N	\N			0
a9d50f35-45c6-467c-ba28-0029a0cd0644	viajar	Next challenge		locked	50	850	["cde585ec-e343-4aac-8090-528f44b33a7d"]	0	0	2	4	\N	\N			0
6529545a-b8a4-466d-a00f-2366656dc1bc	\N	Creá un excel! 	Pasa la informacion de los niveles a un excel	mastered	50	1900	["a3155e07-679f-49ea-85cc-2b1ec1723307"]	0	0	3	3	lanzar_mi_app_1765465891458	\N			0
04249585-c449-4047-b0c8-7797d3688a40	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	5755ce64-2574-4660-b125-89491d4c420d			0
8af50c79-5057-44ba-8cd5-cc88e7ecd17e	\N	Next challenge		locked	50	250	["04249585-c449-4047-b0c8-7797d3688a40"]	0	0	1	2	\N	5755ce64-2574-4660-b125-89491d4c420d			0
0a369ab1-5c2b-49fa-9712-eb109a83d1f2	\N	Next challenge		locked	50	400	["8af50c79-5057-44ba-8cd5-cc88e7ecd17e"]	0	0	1	3	\N	5755ce64-2574-4660-b125-89491d4c420d			0
c845e82e-10a1-41d6-86ab-ca8442757de5	\N	Next challenge		locked	50	550	["0a369ab1-5c2b-49fa-9712-eb109a83d1f2"]	0	0	1	4	\N	5755ce64-2574-4660-b125-89491d4c420d			0
c7de3c69-b5e0-485c-bdff-a3c0a6a264f2	\N	Next challenge		locked	50	700	["c845e82e-10a1-41d6-86ab-ca8442757de5"]	0	1	1	5	\N	5755ce64-2574-4660-b125-89491d4c420d			0
b6f35868-d681-4825-8008-b4d2a1ac915d	\N	inicio		mastered	50	100	[]	0	0	1	1	alimentacin_1765883187549	\N			0
af73a21c-9a0d-4e02-af46-c1aaae13670d	ea23a542-0b32-4f92-88e2-1c436b3b7445	Cambios de Acordes	Practica transiciones fluidas entre acordes.	locked	50	550	["0059e512-0be6-47c6-bedb-b9e8916b6977"]	0	0	1	4	\N	\N			0
3e8d0171-9110-4aed-882f-a7be82cea642	\N	Pagar la visa		mastered	50	250	["9b02a347-2841-45f6-b1e4-2f20d3f01a05"]	0	0	1	2	\N	14046abd-d568-4c26-8c93-54c0ece0f87d	Ya la pagué	Ir a la página web y buscar	0
ec69ee6c-663b-48e5-86ad-e53c357d7fb1	e8f56f74-8263-4425-98b3-c424fb251db3	inicio		mastered	50	100	[]	0	0	1	1	\N	\N			0
3a3f427c-712c-40c9-b03e-117446bdd7cb	e8f56f74-8263-4425-98b3-c424fb251db3	Acordes Básicos	Aprende C, D, E, G, A. ¡Haz clic en el título para ver subtareas!	available	50	250	["ec69ee6c-663b-48e5-86ad-e53c357d7fb1"]	0	0	1	2	\N	\N			0
242e985a-b9df-43c7-8f17-a276a86082c3	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	3a3f427c-712c-40c9-b03e-117446bdd7cb			0
5e904aa7-5ebe-4795-abc4-a8da3496d30a	\N	Acorde C	Practica el acorde de Do mayor	available	50	250	["242e985a-b9df-43c7-8f17-a276a86082c3"]	0	0	1	2	\N	3a3f427c-712c-40c9-b03e-117446bdd7cb			0
1b8d1837-9c54-402f-bfd3-d68f691be36c	\N	Acorde G	Practica el acorde de Sol mayor	locked	50	400	["5e904aa7-5ebe-4795-abc4-a8da3496d30a"]	0	0	1	3	\N	3a3f427c-712c-40c9-b03e-117446bdd7cb			0
8b28695b-4c83-4565-98b6-89140c521a2e	\N	Acorde D	Practica el acorde de Re mayor	locked	50	550	["1b8d1837-9c54-402f-bfd3-d68f691be36c"]	0	0	1	4	\N	3a3f427c-712c-40c9-b03e-117446bdd7cb			0
f7479285-95ed-4157-911f-dfa0e244f252	e8f56f74-8263-4425-98b3-c424fb251db3	Ritmo 4/4	Rasgueo básico. Se desbloquea al completar el anterior.	locked	50	400	["3a3f427c-712c-40c9-b03e-117446bdd7cb"]	0	0	1	3	\N	\N			0
3aad365d-fb0f-4a05-9c11-9393e17764a1	e8f56f74-8263-4425-98b3-c424fb251db3	Cambios de Acordes	Practica transiciones fluidas entre acordes.	locked	50	550	["f7479285-95ed-4157-911f-dfa0e244f252"]	0	0	1	4	\N	\N			0
e0c78ce4-b205-429a-a6a7-bb94d0b28a34	e8f56f74-8263-4425-98b3-c424fb251db3	Primera Canción	Toca tu primera canción completa.	locked	50	700	["3aad365d-fb0f-4a05-9c11-9393e17764a1"]	0	0	1	5	\N	\N			0
521b7605-d203-4dfc-a5bc-baeff0548997	\N	inicio		mastered	50	100	[]	0	0	1	1	063b2f26-f2f1-409a-97e1-f45092e2db89	\N			0
52b58d57-f106-462f-8475-a33bf5d71b35	\N	Elegir fechas	Define cuándo quieres viajar y cuántos días.	available	50	250	["521b7605-d203-4dfc-a5bc-baeff0548997"]	0	0	1	2	063b2f26-f2f1-409a-97e1-f45092e2db89	\N			0
2faaeb22-e231-4bbb-8d2f-5009ceb8df45	\N	Reservar vuelo	Busca y compara precios. ¡Haz clic en el título para ver subtareas!	locked	50	400	["52b58d57-f106-462f-8475-a33bf5d71b35"]	0	0	1	3	063b2f26-f2f1-409a-97e1-f45092e2db89	\N			0
4ca8baf5-2feb-4292-a08a-e934a8885c8c	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	2faaeb22-e231-4bbb-8d2f-5009ceb8df45			0
0fdedce2-81e7-419f-a8ac-5a1a33d3a10c	\N	Comparar precios	Usa Skyscanner, Google Flights, etc.	available	50	250	["4ca8baf5-2feb-4292-a08a-e934a8885c8c"]	0	0	1	2	\N	2faaeb22-e231-4bbb-8d2f-5009ceb8df45			0
4f37c374-0d88-4ee6-a17d-327e1b2e8289	\N	Elegir horarios	Decide el mejor horario de vuelo	locked	50	400	["0fdedce2-81e7-419f-a8ac-5a1a33d3a10c"]	0	0	1	3	\N	2faaeb22-e231-4bbb-8d2f-5009ceb8df45			0
aa350575-9473-4a65-b122-5f61aa2f0e16	\N	Completar reserva	Finaliza la compra del vuelo	locked	50	550	["4f37c374-0d88-4ee6-a17d-327e1b2e8289"]	0	0	1	4	\N	2faaeb22-e231-4bbb-8d2f-5009ceb8df45			0
2678bd96-5952-4f17-b347-839c1f5c0064	\N	Reservar hotel	Encuentra alojamiento en la zona que prefieras.	locked	50	550	["2faaeb22-e231-4bbb-8d2f-5009ceb8df45"]	0	0	1	4	063b2f26-f2f1-409a-97e1-f45092e2db89	\N			0
00d98914-d61f-497f-bf9e-c122d715d6a5	\N	Armar itinerario	Planifica qué lugares visitar cada día.	locked	50	700	["2678bd96-5952-4f17-b347-839c1f5c0064"]	0	0	1	5	063b2f26-f2f1-409a-97e1-f45092e2db89	\N			0
fb8feaac-2dfc-446b-8527-6bc75de6cc28	ea23a542-0b32-4f92-88e2-1c436b3b7445	inicio		mastered	50	100	[]	0	0	1	1	\N	\N			0
2b53a5f8-d586-4fbd-93d4-767ea4aab05c	\N	Guión hablando explicando	Hacer un dialogo como si fuese que estoy explicando mi hipótesis	mastered	50	400	["a13fd10d-e5cc-4e67-b5df-ba43331232c9"]	0	0	1	3	\N	01a7a2b2-d8e7-47c7-b1cc-7f2bf656af99			0
96bad489-2235-40a4-bbe8-f11fb20a67f5	ea23a542-0b32-4f92-88e2-1c436b3b7445	Acordes Básicos	Aprende C, D, E, G, A. ¡Haz clic en el título para ver subtareas!	available	50	250	["fb8feaac-2dfc-446b-8527-6bc75de6cc28"]	0	0	1	2	\N	\N			0
0059e512-0be6-47c6-bedb-b9e8916b6977	ea23a542-0b32-4f92-88e2-1c436b3b7445	Ritmo 4/4	Rasgueo básico. Se desbloquea al completar el anterior.	locked	50	400	["96bad489-2235-40a4-bbe8-f11fb20a67f5"]	0	0	1	3	\N	\N			0
a13fd10d-e5cc-4e67-b5df-ba43331232c9	\N	Leer para ver	Leer para ver si tengo una idea	mastered	50	250	["4ad37e29-6b7b-4d93-a176-73249f827fb0"]	0	0	1	2	\N	01a7a2b2-d8e7-47c7-b1cc-7f2bf656af99			0
b5f6ef95-3d37-4936-960e-d02d7c69b352	viajar	Equipá sin perder		mastered	50	250	["b5f6ef95-3d37-4936-960e-d02d7c69b352"]	0	0	1	2	\N	\N			0
ed70c2c9-77e6-4592-b2d7-d664fd4efadf	\N	Next challenge		locked	50	1000	["140c045f-64b2-44aa-aebc-f85304eee619"]	0	0	1	7	alimentacin_1765883187549	\N			0
66139cc7-f0fb-4d1d-8523-ec854ac03566	\N	Turno para nutricionista 	Sacá turno con una nutricionista de la cartilla\n\nWhen: El jueves	mastered	50	250	["b6f35868-d681-4825-8008-b4d2a1ac915d"]	0	0	1	2	alimentacin_1765883187549	\N			0
140c045f-64b2-44aa-aebc-f85304eee619	\N	armar una lista segùn las recetas		available	50	850	["bc37bfb3-fa1c-435c-a381-72cbc3a46ec4"]	0	0	1	6	alimentacin_1765883187549	\N			0
bc37bfb3-fa1c-435c-a381-72cbc3a46ec4	\N	Ver recetas pinterest		mastered	50	400	["66139cc7-f0fb-4d1d-8523-ec854ac03566"]	0	0	1	3	alimentacin_1765883187549	\N			0
8bded79e-feb3-4b81-b671-422ef6db983d	viajar	inicio		mastered	50	100	[]	0	0	1	1	\N	\N			0
86ad57da-b7c4-41b9-b16c-af42033a5129	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	96bad489-2235-40a4-bbe8-f11fb20a67f5			0
0f3ec7d3-3bfb-4f13-aebe-895060afa7be	\N	Acorde C	Practica el acorde de Do mayor	available	50	250	["86ad57da-b7c4-41b9-b16c-af42033a5129"]	0	0	1	2	\N	96bad489-2235-40a4-bbe8-f11fb20a67f5			0
565ac22b-fba7-461f-a3b4-d1f27f8e8884	\N	Acorde G	Practica el acorde de Sol mayor	locked	50	400	["0f3ec7d3-3bfb-4f13-aebe-895060afa7be"]	0	0	1	3	\N	96bad489-2235-40a4-bbe8-f11fb20a67f5			0
0bfa524a-0c8e-4e63-9109-85a9c49c06d4	\N	Acorde D	Practica el acorde de Re mayor	locked	50	550	["565ac22b-fba7-461f-a3b4-d1f27f8e8884"]	0	0	1	4	\N	96bad489-2235-40a4-bbe8-f11fb20a67f5			0
f37497e4-e65c-47b8-b2c6-d94bced8466b	ea23a542-0b32-4f92-88e2-1c436b3b7445	Primera Canción	Toca tu primera canción completa.	locked	50	700	["af73a21c-9a0d-4e02-af46-c1aaae13670d"]	0	0	1	5	\N	\N			0
3a8197c1-a26e-445c-8c93-3974461d2c4c	\N	inicio		mastered	50	100	[]	0	0	1	1	a5cb63d6-d46c-433d-921f-fde2a3fb5fec	\N			0
1ac5ab69-d7e5-4853-b2eb-dc8027e82474	\N	Acorde C	Practica el acorde de Do mayor hasta que suene limpio	available	50	300	[]	0	0	1	2	\N	2e5809be-388e-429f-a366-9f70764cff1b			0
85eafeb9-3285-428b-8609-d6051186c951	5e041685-7fc3-4eda-8974-a3af7c794dc9	Acordes Básicos	Aprende C, D, E, G, A. ¡Haz clic en el título para ver subtareas!	available	50	250	["9309c517-6501-4228-bedb-99d1b900af6d"]	0	0	1	2	\N	\N			0
d2bcce07-24c7-4ef3-a0ae-9067c729f090	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	31f6a075-8510-4c7f-87fc-bdfd12839dc9			0
cdd071d8-edd7-4f25-8b57-a26c4484c8d7	\N	Comparar precios	Usa Skyscanner, Google Flights, etc.	available	50	250	["d2bcce07-24c7-4ef3-a0ae-9067c729f090"]	0	0	1	2	\N	31f6a075-8510-4c7f-87fc-bdfd12839dc9			0
0408798c-871e-464d-aa13-57045c5a71d9	\N	Elegir horarios	Decide el mejor horario de vuelo	locked	50	400	["cdd071d8-edd7-4f25-8b57-a26c4484c8d7"]	0	0	1	3	\N	31f6a075-8510-4c7f-87fc-bdfd12839dc9			0
deb4e365-6b24-41d0-aa82-f73d19644070	\N	Completar reserva	Finaliza la compra del vuelo	locked	50	550	["0408798c-871e-464d-aa13-57045c5a71d9"]	0	0	1	4	\N	31f6a075-8510-4c7f-87fc-bdfd12839dc9			0
a209f41f-0a5a-4dce-a7f6-b7436e5e7568	\N	Reservar hotel	Encuentra alojamiento en la zona que prefieras.	locked	50	550	["31f6a075-8510-4c7f-87fc-bdfd12839dc9"]	0	0	1	4	a5cb63d6-d46c-433d-921f-fde2a3fb5fec	\N			0
b125d10e-d2a9-4f9e-a8cd-41839f4ca247	\N	Armar itinerario	Planifica qué lugares visitar cada día.	locked	50	700	["a209f41f-0a5a-4dce-a7f6-b7436e5e7568"]	0	0	1	5	a5cb63d6-d46c-433d-921f-fde2a3fb5fec	\N			0
e20e7718-d323-4316-9c01-69a6284ee44c	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	cf7e730f-76e8-4cc1-b379-ab7ecefc024f			0
45ba3cf6-dcfa-4dc7-9c58-6ae760fdb2e7	\N	Next challenge		locked	50	250	["e20e7718-d323-4316-9c01-69a6284ee44c"]	0	0	1	2	\N	cf7e730f-76e8-4cc1-b379-ab7ecefc024f			0
948d4e2e-14a7-46bf-85c6-25b6b7cbfd9c	\N	Next challenge		locked	50	400	["45ba3cf6-dcfa-4dc7-9c58-6ae760fdb2e7"]	0	0	1	3	\N	cf7e730f-76e8-4cc1-b379-ab7ecefc024f			0
f8ea5a19-b510-4bdb-ab54-b8f74ea3ab14	\N	Next challenge		locked	50	550	["948d4e2e-14a7-46bf-85c6-25b6b7cbfd9c"]	0	0	1	4	\N	cf7e730f-76e8-4cc1-b379-ab7ecefc024f			0
69763695-8029-46e0-815d-777c0a517471	\N	Next challenge		locked	50	700	["f8ea5a19-b510-4bdb-ab54-b8f74ea3ab14"]	0	1	1	5	\N	cf7e730f-76e8-4cc1-b379-ab7ecefc024f			0
989e2f1b-68d9-41d0-b1f3-b9c0a854fe2a	casa_limpia	inicio		mastered	50	100	[]	0	0	1	1	\N	\N			0
cf7e730f-76e8-4cc1-b379-ab7ecefc024f	\N	Elegir fechas	Define cuándo quieres viajar y cuántos días.	available	50	250	["3a8197c1-a26e-445c-8c93-3974461d2c4c"]	0	0	1	2	a5cb63d6-d46c-433d-921f-fde2a3fb5fec	\N			0
31f6a075-8510-4c7f-87fc-bdfd12839dc9	\N	Reservar vuelo	Busca y compara precios. ¡Haz clic en el título para ver subtareas!	locked	50	400	["cf7e730f-76e8-4cc1-b379-ab7ecefc024f"]	0	0	1	3	a5cb63d6-d46c-433d-921f-fde2a3fb5fec	\N			0
6d1d7fc0-b157-4f23-89f3-ad683d6fe5de	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	85eafeb9-3285-428b-8609-d6051186c951			0
412b9f64-1fd6-41e7-9ab0-c725921301eb	\N	inicio		mastered	50	150	[]	0	0	1	1	\N	2e5809be-388e-429f-a366-9f70764cff1b			0
b917a57a-2175-4037-8fe9-86db5203379a	\N	Acorde C	Practica el acorde de Do mayor	available	50	250	["6d1d7fc0-b157-4f23-89f3-ad683d6fe5de"]	0	0	1	2	\N	85eafeb9-3285-428b-8609-d6051186c951			0
77a7fdb4-1ff0-467d-baf8-4429ab61fb9a	\N	Acorde G	Practica el acorde de Sol mayor	locked	50	400	["b917a57a-2175-4037-8fe9-86db5203379a"]	0	0	1	3	\N	85eafeb9-3285-428b-8609-d6051186c951			0
49d428e6-124f-4519-a2b0-070e4dba1a5d	\N	inicio		mastered	50	150	[]	0	0	1	1	\N	trip-skill-3			0
07ceb121-54e0-4174-8e2b-e2b7c1f886ed	\N	Acorde D	Practica el acorde de Re mayor	locked	50	550	["77a7fdb4-1ff0-467d-baf8-4429ab61fb9a"]	0	0	1	4	\N	85eafeb9-3285-428b-8609-d6051186c951			0
310e93e3-3264-48ee-b4ed-32229f2fd937	5e041685-7fc3-4eda-8974-a3af7c794dc9	Ritmo 4/4	Rasgueo básico. Se desbloquea al completar el anterior.	locked	50	400	["85eafeb9-3285-428b-8609-d6051186c951"]	0	0	1	3	\N	\N			0
7c4e96a6-ea2b-43c4-801a-5a0bc141306e	\N	Acorde G	Practica el acorde de Sol mayor	locked	50	450	[]	0	0	1	3	\N	2e5809be-388e-429f-a366-9f70764cff1b			0
d6515d3e-4f71-4b5f-bd09-3e2988801d5d	\N	Acorde D	Practica el acorde de Re mayor	locked	50	600	[]	0	0	1	4	\N	2e5809be-388e-429f-a366-9f70764cff1b			0
30b6b3af-a4f2-411a-a014-f9ed32ee46d8	\N	Comparar precios	Usa Skyscanner, Google Flights, Kayak	available	50	300	[]	0	0	1	2	\N	trip-skill-3			0
19e8249b-2cd6-4c5e-b02b-a9f96a714aaf	\N	Elegir horarios	Decide el mejor horario de vuelo	locked	50	450	[]	0	0	1	3	\N	trip-skill-3			0
6b466c65-28f4-4d19-bef4-eb64ffea8c6d	\N	Completar reserva	Finaliza la compra del vuelo	locked	50	600	[]	0	0	1	4	\N	trip-skill-3			0
9309c517-6501-4228-bedb-99d1b900af6d	5e041685-7fc3-4eda-8974-a3af7c794dc9	inicio		mastered	50	100	[]	0	0	1	1	\N	\N			0
1988a9ce-b99c-435e-9fc8-51796cea6a88	5e041685-7fc3-4eda-8974-a3af7c794dc9	Cambios de Acordes	Practica transiciones fluidas entre acordes.	locked	50	550	["310e93e3-3264-48ee-b4ed-32229f2fd937"]	0	0	1	4	\N	\N			0
5d053866-039b-411a-8732-e9ea660b10bc	5e041685-7fc3-4eda-8974-a3af7c794dc9	Primera Canción	Toca tu primera canción completa.	locked	50	700	["1988a9ce-b99c-435e-9fc8-51796cea6a88"]	0	0	1	5	\N	\N			0
293a8b92-5c59-48a7-821c-c7a70bfb40f6	\N	inicio		mastered	50	100	[]	0	0	1	1	a4457b87-0ee1-40a0-95e3-c7a812298be7	\N			0
de1c7aa8-b7c5-4490-b956-671b0c4fdfd4	\N	Elegir fechas	Define cuándo quieres viajar y cuántos días.	available	50	250	["293a8b92-5c59-48a7-821c-c7a70bfb40f6"]	0	0	1	2	a4457b87-0ee1-40a0-95e3-c7a812298be7	\N			0
07443f78-40ff-4661-bf4c-5f2ca6e28fa3	\N	Reservar vuelo	Busca y compara precios. ¡Haz clic en el título para ver subtareas!	locked	50	400	["de1c7aa8-b7c5-4490-b956-671b0c4fdfd4"]	0	0	1	3	a4457b87-0ee1-40a0-95e3-c7a812298be7	\N			0
6db2fb2f-42a5-4600-8493-ad87db27127b	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	07443f78-40ff-4661-bf4c-5f2ca6e28fa3			0
98cfd4ec-1182-40a5-987c-0dcc637f2482	\N	Comparar precios	Usa Skyscanner, Google Flights, etc.	available	50	250	["6db2fb2f-42a5-4600-8493-ad87db27127b"]	0	0	1	2	\N	07443f78-40ff-4661-bf4c-5f2ca6e28fa3			0
1e33cfe2-2bf2-4ba4-99cc-40440cc16bf9	\N	Elegir horarios	Decide el mejor horario de vuelo	locked	50	400	["98cfd4ec-1182-40a5-987c-0dcc637f2482"]	0	0	1	3	\N	07443f78-40ff-4661-bf4c-5f2ca6e28fa3			0
a78f6380-8ffb-443c-ad08-ae6dff27849c	\N	Completar reserva	Finaliza la compra del vuelo	locked	50	550	["1e33cfe2-2bf2-4ba4-99cc-40440cc16bf9"]	0	0	1	4	\N	07443f78-40ff-4661-bf4c-5f2ca6e28fa3			0
5de4671a-e7dd-4f4c-a38a-31423424d75d	\N	Reservar hotel	Encuentra alojamiento en la zona que prefieras.	locked	50	550	["07443f78-40ff-4661-bf4c-5f2ca6e28fa3"]	0	0	1	4	a4457b87-0ee1-40a0-95e3-c7a812298be7	\N			0
2aebcb15-7b00-4b36-9098-ffd6e44111de	\N	Armar itinerario	Planifica qué lugares visitar cada día.	locked	50	700	["5de4671a-e7dd-4f4c-a38a-31423424d75d"]	0	0	1	5	a4457b87-0ee1-40a0-95e3-c7a812298be7	\N			0
09f21aab-d933-41a9-b631-936adc64d57f	c97eb9d2-f283-4b8e-9be4-6eb5c3008217	inicio		mastered	50	100	[]	0	0	1	1	\N	\N			0
17a16ee0-d15d-4ccb-b6c1-75638bedbed8	c97eb9d2-f283-4b8e-9be4-6eb5c3008217	Cambios de Acordes	Practica transiciones fluidas entre acordes.	available	50	550	["3f631236-761d-4e27-bbe8-1570e50dc758"]	0	0	1	4	\N	\N			0
6134037f-bc99-4927-82a7-b81cef2c2339	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	88f647b8-410f-4ee3-9555-ad536961e909			0
1e4f2650-9e4c-4329-a64c-eca5b685da04	\N	Acorde C	Practica el acorde de Do mayor	available	50	250	["6134037f-bc99-4927-82a7-b81cef2c2339"]	0	0	1	2	\N	88f647b8-410f-4ee3-9555-ad536961e909			0
7fb13306-03e1-4fa4-9c81-1e9914cf6709	\N	Acorde G	Practica el acorde de Sol mayor	locked	50	400	["1e4f2650-9e4c-4329-a64c-eca5b685da04"]	0	0	1	3	\N	88f647b8-410f-4ee3-9555-ad536961e909			0
98b424f1-2e55-48a8-882f-a8b0ea4ea07e	\N	Acorde D	Practica el acorde de Re mayor	locked	50	550	["7fb13306-03e1-4fa4-9c81-1e9914cf6709"]	0	0	1	4	\N	88f647b8-410f-4ee3-9555-ad536961e909			0
a27dcb49-6076-46d6-b883-9c000559cc12	ftbol	Bajar rápido siempre	Bajar rápido cada vez que atacan 	mastered	50	550	["74e3ddca-a079-41cf-abdb-1845bc101b93"]	0	0	1	4	\N	\N			0
a327e1f9-2bc2-42f2-a674-147c8cdff9e3	casa_limpia	Next challenge		available	50	400	["9d10bec1-8b76-4376-b26f-3a4178bd4e6d"]	0	0	1	3	\N	\N			0
ff0f519b-7519-44ce-a679-137d1a0f2b36	c97eb9d2-f283-4b8e-9be4-6eb5c3008217	Primera Canción	Toca tu primera canción completa.	locked	50	700	["17a16ee0-d15d-4ccb-b6c1-75638bedbed8"]	0	0	1	5	\N	\N			0
3c16acc5-cdee-4eb3-9e8e-581498a0363d	\N	inicio		mastered	50	100	[]	0	0	1	1	e18cbd16-6c86-432e-a61e-dedd623f87ce	\N			0
0e5fd349-9091-4f7f-80e1-aa85e9ebb40d	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	e160d847-c183-4fe8-8503-a5b969c0a3be			0
a2b77146-2d37-42b9-9dc7-caf2a9990084	\N	Comparar precios	Usa Skyscanner, Google Flights, etc.	available	50	250	["0e5fd349-9091-4f7f-80e1-aa85e9ebb40d"]	0	0	1	2	\N	e160d847-c183-4fe8-8503-a5b969c0a3be			0
2bdaad48-7b39-43e3-91da-4f9d3077532e	\N	Elegir horarios	Decide el mejor horario de vuelo	locked	50	400	["a2b77146-2d37-42b9-9dc7-caf2a9990084"]	0	0	1	3	\N	e160d847-c183-4fe8-8503-a5b969c0a3be			0
1b9dfa86-f09e-4819-aeaf-20a7eed12a2e	\N	Reservar hotel	Encuentra alojamiento en la zona que prefieras.	locked	50	550	["e160d847-c183-4fe8-8503-a5b969c0a3be"]	0	0	1	4	e18cbd16-6c86-432e-a61e-dedd623f87ce	\N			0
46276d26-80be-4a61-be6f-7cad651ef9e4	\N	Armar itinerario	Planifica qué lugares visitar cada día.	locked	50	700	["1b9dfa86-f09e-4819-aeaf-20a7eed12a2e"]	0	0	1	5	e18cbd16-6c86-432e-a61e-dedd623f87ce	\N			0
88f647b8-410f-4ee3-9555-ad536961e909	c97eb9d2-f283-4b8e-9be4-6eb5c3008217	Acordes Básicos	Aprende C, D, E, G, A. ¡Haz clic en el título para ver subtareas!	mastered	50	250	["09f21aab-d933-41a9-b631-936adc64d57f"]	0	0	1	2	\N	\N			0
e882d07f-d354-40ac-92b4-14d90fc8029a	casa_limpia	Next challenge		locked	50	550	["a327e1f9-2bc2-42f2-a674-147c8cdff9e3"]	0	0	1	4	\N	\N			0
3f631236-761d-4e27-bbe8-1570e50dc758	c97eb9d2-f283-4b8e-9be4-6eb5c3008217	Ritmo 4/4	Rasgueo básico. Se desbloquea al completar el anterior.	mastered	50	400	["88f647b8-410f-4ee3-9555-ad536961e909"]	0	0	1	3	\N	\N			0
34015d5a-7ddc-488b-9415-f81d14f60e19	\N	Elegir fechas	Define cuándo quieres viajar y cuántos días.	available	50	250	["3c16acc5-cdee-4eb3-9e8e-581498a0363d"]	0	0	1	2	e18cbd16-6c86-432e-a61e-dedd623f87ce	\N			0
e160d847-c183-4fe8-8503-a5b969c0a3be	\N	Reservar vuelo	Busca y compara precios. ¡Haz clic en el título para ver subtareas!	locked	50	400	["34015d5a-7ddc-488b-9415-f81d14f60e19"]	0	0	1	3	e18cbd16-6c86-432e-a61e-dedd623f87ce	\N			0
74e3ddca-a079-41cf-abdb-1845bc101b93	ftbol	Bajar rápido x3	En el ataque bajá rápido\n\nWhen: Próximo partido	mastered	50	400	["5f85e374-6070-4007-a48b-57374241e1ba"]	0	0	1	3	\N	\N			0
f19c1796-7033-4e1b-a7e7-9f4bbdefb71d	ftbol	inicio		mastered	50	100	[]	0	0	1	1	\N	\N			0
53741288-2261-4369-8201-c4d2c91f12ec	ftbol	Bajar rápido defensa		available	50	700	["a27dcb49-6076-46d6-b883-9c000559cc12"]	0	0	1	5	\N	\N			0
5f85e374-6070-4007-a48b-57374241e1ba	ftbol	Poner el cuerpo	Poner las manos hacia atras para recibir y que no te  molesten\n\nWhen: El partido del Sábado	mastered	50	250	["f19c1796-7033-4e1b-a7e7-9f4bbdefb71d"]	0	0	1	2	\N	\N			0
b2f88772-4aab-4833-a14f-5cd55e473f9c	\N	Completar reserva	Finaliza la compra del vuelo	locked	50	550	["2bdaad48-7b39-43e3-91da-4f9d3077532e"]	0	0	1	4	\N	e160d847-c183-4fe8-8503-a5b969c0a3be			0
a68f87aa-8860-483d-8d32-55fc0f7d88c8	casa_limpia	Next challenge		locked	50	700	["e882d07f-d354-40ac-92b4-14d90fc8029a"]	0	0	1	5	\N	\N			0
505035fa-b059-4ce9-b8e6-a89d8fcbba0d	meditacin	Averigué sobre cómo mantenerme presente	Averiguar por el objetivo de mantenerse presente	mastered	50	250	["5e39e547-142a-4707-84ca-d0c3e5e31a30"]	0	0	1	3	\N	\N			0
5f97acd4-9372-4b41-ad73-15e6a7c8841a	\N	Hablarle a Mario		available	50	250	["3d0fe5a0-c918-413a-875b-ac0fdc516de1"]	0	0	1	2	lavadero_1767697136314	\N			0
e31c2670-bf51-430a-801f-27fefa83ade2	meditacin	Descubrí por qué meditar	Reflexioná sobre por qué quiero aumentar mi capacidad de meditar y qué quiero lograr con eso	mastered	50	400	["e31c2670-bf51-430a-801f-27fefa83ade2"]	0	0	1	2	\N	\N			0
0c79f9d5-3808-4c84-9f39-dad60f65af70	\N	¡A crear un skilltree de vocabulario!		available	50	2350	["46181088-4b3b-493d-a231-49cc78ba5f10"]	0	0	4	2	lanzar_mi_app_1765465891458	\N			0
4698ad2c-bc95-48a9-8be2-f683f9d6bab8	\N	Cambiar la gomita		mastered	50	850	["ce121026-18cf-4d07-a774-bc60028b4578"]	0	0	1	9	botn_del_bao_1765396404032	\N		Abrí, buscá, probá y cerrá	0
e11a7309-1146-46ac-af93-ff959beba7c8	\N			mastered	50	1000	[]	0	0	2	4	botn_del_bao_1765396404032	\N			0
65dabda4-1ceb-4331-8b1b-75cc39534c84	\N	Diario de frustración	Escribí en el diario cuando te frustrás	mastered	50	850	["e52fd32b-3f2b-4674-82c9-8edf6cb9a2cb"]	0	0	1	6	alexis_o_el_tratado_del_intil_combate_1765405345491	\N			0
5e39e547-142a-4707-84ca-d0c3e5e31a30	meditacin	inicio		mastered	50	100	[]	0	0	1	1	\N	\N			0
963d8a62-ceca-4317-87b7-7550c90d3480	\N	inicio		mastered	50	100	[]	0	0	1	1	botn_del_bao_1765396404032	\N			0
4c3bc701-0578-4b0a-b5a7-daf57b1a766b	msica	Solfeo duolingo	Repasar solfeo en velocidad	mastered	50	550	["f5743162-24b9-448e-8cd4-f706b3c9475f"]	0	0	1	5	\N	\N			0
443568b8-ff5f-4d61-b87b-8eb865a8caf5	\N	Poner el viejo		mastered	50	1450	["128c0d93-03c3-4ff2-885c-267cfff03158"]	0	1	2	8	botn_del_bao_1765396404032	\N			0
46181088-4b3b-493d-a231-49cc78ba5f10	\N			mastered	50	2200	[]	0	0	4	1	lanzar_mi_app_1765465891458	\N			0
e2c465b1-988d-4730-b7be-0cea4e7b6743	\N	Next challenge		locked	50	2500	["0c79f9d5-3808-4c84-9f39-dad60f65af70"]	0	0	4	3	lanzar_mi_app_1765465891458	\N			0
23c35ec2-1c83-4fe5-8e4c-30069923f4cd	\N	Hipótesis		mastered	50	250	["f6c7bc40-e688-4f93-a7ae-8bdb7a5acf01"]	0	0	1	3	alexis_o_el_tratado_del_intil_combate_1765405345491	\N		Reformulá la hipótesis	0
f8e51ee2-29a4-4ac7-b3e6-d84a031297a0	\N	Ir a ferretería	Comprar todo la mochila con el tapón y cambiarlo	mastered	50	1150	["e11a7309-1146-46ac-af93-ff959beba7c8"]	0	0	2	5	botn_del_bao_1765396404032	\N			0
128c0d93-03c3-4ff2-885c-267cfff03158	\N	Poner flotante nuevo		mastered	50	1300	["f8e51ee2-29a4-4ac7-b3e6-d84a031297a0"]	0	0	2	6	botn_del_bao_1765396404032	\N			0
ac89c1ba-a2aa-4243-8f48-6693f04ae8ae	\N	Subir a github		mastered	50	250	["1d710ca2-ee91-4197-9b2e-332a8449f75d"]	0	0	1	2	\N	f684fd64-d695-41fe-be60-2efb6df3b3c8			0
dc135af7-c3dc-43a7-9855-72b32c58c2d9	\N	Next challenge		locked	50	2650	["e2c465b1-988d-4730-b7be-0cea4e7b6743"]	0	0	4	4	lanzar_mi_app_1765465891458	\N			0
9d10bec1-8b76-4376-b26f-3a4178bd4e6d	casa_limpia	Limpiar los Pisos	Barrer y limpiar el piso del baño	mastered	50	250	["989e2f1b-68d9-41d0-b1f3-b9c0a854fe2a"]	0	0	1	2	\N	\N			0
55b5b4ca-ba3c-4a1a-b11d-415ee41a7cda	\N	Hablar estando procesando		locked	50	700	["9016f679-a425-4620-9a72-1c005c171dec"]	0	0	1	7	relacin_sana_1767217260261	\N			0
3d0fe5a0-c918-413a-875b-ac0fdc516de1	\N	inicio		mastered	50	100	[]	0	0	1	1	lavadero_1767697136314	\N			0
7df53b08-33ba-4566-844a-bdd845ecf53e	\N	Chusmear		mastered	50	250	["963d8a62-ceca-4317-87b7-7550c90d3480"]	0	0	1	5	botn_del_bao_1765396404032	\N			0
1ee54c10-412b-41c4-9fa6-a758696c7d19	\N	Escribí qué pensás	Releé los comentarios y dejate llevar por tus pensamientos	mastered	50	700	["23c35ec2-1c83-4fe5-8e4c-30069923f4cd"]	0	0	1	3	alexis_o_el_tratado_del_intil_combate_1765405345491	\N	Me tengo que dejar llevar. Total yo sé que puedo encontrarle algo interesante para decir.	Lee los comentarios y relacionalos con tus subrayados	0
8dedf34e-9da5-4812-afdc-13c3e80903df	\N	Next challenge		locked	50	400	["5f97acd4-9372-4b41-ad73-15e6a7c8841a"]	0	0	1	3	lavadero_1767697136314	\N			0
175cfbc7-3f86-4dd4-908d-c341448258e7	\N	Next challenge		locked	50	550	["8dedf34e-9da5-4812-afdc-13c3e80903df"]	0	0	1	4	lavadero_1767697136314	\N			0
6bc776b3-6ba0-404c-9a8d-583ab20c3f13	\N	Next challenge		locked	50	2800	["dc135af7-c3dc-43a7-9855-72b32c58c2d9"]	0	0	4	5	lanzar_mi_app_1765465891458	\N			0
e52fd32b-3f2b-4674-82c9-8edf6cb9a2cb	\N	Expresate		mastered	50	400	["1ee54c10-412b-41c4-9fa6-a758696c7d19"]	0	0	1	4	alexis_o_el_tratado_del_intil_combate_1765405345491	\N		Decí las sensaciones que te dio la novela sin juzgarte	0
f6c7bc40-e688-4f93-a7ae-8bdb7a5acf01	\N	inicio		mastered	50	100	[]	0	0	1	1	alexis_o_el_tratado_del_intil_combate_1765405345491	\N			0
9eef798f-9608-4956-b4b0-e69a63464289	meditacin	hacer una lista de por qué meditar	Necesito incluir la meditación en mi hora de descanso pero a veces le pierdo el sentido de por qué hacerlo.  Me cuesta querer.	available	50	550	["505035fa-b059-4ce9-b8e6-a89d8fcbba0d"]	0	0	1	5	\N	\N			0
12acd738-846e-4c8d-af2c-1da6dbf58ffd	ftbol			locked	50	850	[]	0	0	2	1	\N	\N			0
af135ae0-5538-41a0-ad89-bb28c1d8a67d	\N	Alambre		mastered	50	550	["5137478d-23e5-47dc-9c25-fae27a16c6fb"]	0	0	1	7	botn_del_bao_1765396404032	\N		Mejorar la forma del alambre para que no se mueva	0
8897dbc4-1f97-4a67-bc09-4b53677091b0	ftbol	Next challenge		locked	50	1150	["d1360c37-7bd4-4cdb-b320-38a847a32537"]	0	0	2	3	\N	\N			0
033d99a2-f393-4ed5-be2f-e49d156c6ce9	\N	Guión Level 4	Hacer un dialogo como si fuese que estoy explicando mi hipótesis:\nTerminar de explicar el proccedimiento y separar en partes.	mastered	50	1000	["2b53a5f8-d586-4fbd-93d4-767ea4aab05c"]	0	1	1	7	\N	01a7a2b2-d8e7-47c7-b1cc-7f2bf656af99	Intenté priorizar fluir. No puse tiempo porque quería poner toda mi intención a fluir. \nEstaba intentando de separar bien dos ideas que son confundibles. No sabía si podría encontrar esa diferencia que marque en un momento. Así que releí y busqué donde veía la diferencia. Necesité cambiar las citas que marcan una u otra cosa porque solo una  de las tres citas me pareció que podía justificar eso que analicé. \nQuiero fluir y sé que si me distraigo con otra cosa se me corta el flujo. Sin embargo castigarme por haberme distraído o por que alguien me haya distraído también me corta el flujo. Inclusive más que la distracción misma. Creo que me  dejé distraer sin pena y eso me sirvió para no frustrarme y volver al flujo más rápido.\nTambién me di cuenta que necesito decirlo oralmente para sentirme más segura. Así como salga.		0
33f8f506-c76e-4b9f-b6c8-2d68778c4c51	\N	Guión Level 2	Hacer un dialogo como si fuese que estoy explicando mi hipótesis: Las meditaciones	mastered	50	700	["2344403f-8e69-4ab1-9b91-61f4bf0de156"]	0	0	1	5	\N	01a7a2b2-d8e7-47c7-b1cc-7f2bf656af99			0
834470b3-59c7-44ad-ad1a-42536c3a70ee	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	d70cb977-71e7-4f4f-aeae-b8165e793e8d			0
2344403f-8e69-4ab1-9b91-61f4bf0de156	\N	Guión Level 1	Hacer un dialogo como si fuese que estoy explicando mi hipótesis: El deseo de explicar de Alexis	mastered	50	550	["2b53a5f8-d586-4fbd-93d4-767ea4aab05c"]	0	0	1	4	\N	01a7a2b2-d8e7-47c7-b1cc-7f2bf656af99			0
49bba784-2d71-4fd9-aef0-2ab1fedaaf33	ftbol	Next challenge		locked	50	1300	["8897dbc4-1f97-4a67-bc09-4b53677091b0"]	0	0	2	4	\N	\N			0
dd58c5fb-3840-4f5f-8946-0be66987b467	\N	Introducción	Decilo como te salga hasta que te trabes y repasá esa parte	mastered	50	250	["834470b3-59c7-44ad-ad1a-42536c3a70ee"]	0	0	1	2	\N	d70cb977-71e7-4f4f-aeae-b8165e793e8d			0
2a4e4e2f-1481-4ff4-b7d3-9efdb2597710	ftbol	Next challenge		locked	50	1450	["49bba784-2d71-4fd9-aef0-2ab1fedaaf33"]	0	0	2	5	\N	\N			0
3a1d6085-84bf-4c97-ad41-a4d3b6b6bc7c	\N	Hipótesis	Ahora vamos a intentar de explicar lo fuerte de la hipótesis	mastered	50	400	["dd58c5fb-3840-4f5f-8946-0be66987b467"]	0	0	1	3	\N	d70cb977-71e7-4f4f-aeae-b8165e793e8d			0
e093e458-9cf8-4800-8109-03a02e9ec588	\N	Next challenge		mastered	50	550	["3a1d6085-84bf-4c97-ad41-a4d3b6b6bc7c"]	0	1	1	5	\N	d70cb977-71e7-4f4f-aeae-b8165e793e8d			0
5137478d-23e5-47dc-9c25-fae27a16c6fb	\N	Revisar	Me estresé porque me chorreaba agua en la cara. Hubiese preferido no putear.	mastered	50	400	["7df53b08-33ba-4566-844a-bdd845ecf53e"]	0	0	1	6	botn_del_bao_1765396404032	\N		Sacar y fijarse por qué no funciona el botón 	0
2e5e526b-3deb-4ae5-b797-9b3f4e4e5556	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	02dd9eea-7445-4df5-91f7-5ddbe9aabb61			0
046c4e3a-5074-48a8-870c-68280ec3e647	\N	Next challenge		mastered	50	250	["2e5e526b-3deb-4ae5-b797-9b3f4e4e5556"]	0	0	1	2	\N	02dd9eea-7445-4df5-91f7-5ddbe9aabb61			0
eb0575b2-ac1c-4de5-9d55-adf7e4c85fd6	\N	Next challenge		mastered	50	400	["046c4e3a-5074-48a8-870c-68280ec3e647"]	0	0	1	3	\N	02dd9eea-7445-4df5-91f7-5ddbe9aabb61			0
ed3ca366-8601-42a3-9484-622b44858ffd	\N	Next challenge		mastered	50	550	["eb0575b2-ac1c-4de5-9d55-adf7e4c85fd6"]	0	0	1	4	\N	02dd9eea-7445-4df5-91f7-5ddbe9aabb61			0
fc40b040-8b1e-4979-a398-06bae6cea0f6	\N	¿Será Firebase?	Aprender cómo funciona firebase	mastered	50	1000	["361d3297-17b5-41da-a169-ec0ece99d6b7"]	0	0	2	3	lanzar_mi_app_1765465891458	\N			0
4b846731-ed24-4cb6-8b45-65afffa29301	\N	Next challenge		mastered	50	700	["ed3ca366-8601-42a3-9484-622b44858ffd"]	0	1	1	5	\N	02dd9eea-7445-4df5-91f7-5ddbe9aabb61			0
d1360c37-7bd4-4cdb-b320-38a847a32537	ftbol	Next challenge		locked	50	1000	["12acd738-846e-4c8d-af2c-1da6dbf58ffd"]	0	0	2	2	\N	\N			0
b61c413e-0097-4cea-b4bf-44dddc823eb3	social	Next challenge		locked	50	400	["436b782c-3a57-407f-8c11-8ec0ea47477b"]	0	0	1	3	\N	\N			0
df8c0011-2a97-4607-a423-5cd43aaec857	\N	Ver recetas pinterest		mastered	50	550	["bc37bfb3-fa1c-435c-a381-72cbc3a46ec4"]	0	0	1	4	alimentacin_1765883187549	\N			0
0e456fa9-270e-40c7-9616-07749f6bc6da	social	inicio		mastered	50	100	[]	0	0	1	1	\N	\N			0
436b782c-3a57-407f-8c11-8ec0ea47477b	social	Buscar una forma	Si en un grupo escucho un comentario ofensivo hacia mi estilo de vida o mi género o sexualidad.  Como se es asertivo frente a personas que no conozco mucho y opino diferente en temas sociales?	available	50	250	["0e456fa9-270e-40c7-9616-07749f6bc6da"]	0	0	1	2	\N	\N			0
58226825-97d6-4ed8-8a4a-93e17dba8c9c	escribir	inicio		mastered	50	100	[]	0	0	1	1	\N	\N			0
1773e21b-4d4e-4e48-9da8-4c6280f8143e	escribir	Next challenge		locked	50	700	["d0ac72d1-70d3-4c5d-8afe-5729c5fd4bbd"]	0	0	1	5	\N	\N			0
71e68205-85c1-4d2c-8414-21bc012e5498	social	Next challenge		locked	50	550	["b61c413e-0097-4cea-b4bf-44dddc823eb3"]	0	0	1	4	\N	\N			0
eff529ef-4f2a-455e-8aa8-324b54d0cf7a	escribir	Mi próximo sueño	El próximo sueño escribilo de manera más literaria	mastered	50	250	["58226825-97d6-4ed8-8a4a-93e17dba8c9c"]	0	0	1	2	\N	\N			0
ccad2978-f1f0-475c-95b1-0ac01fa0f5be	escribir	Escribir mi sueño	Describir mejor mis sueños	locked	50	550	["ccad2978-f1f0-475c-95b1-0ac01fa0f5be"]	0	0	1	3	\N	\N			0
50ba7967-a9ae-488f-8031-a3cf2c9d58a5	\N	Ver recetas pinterest		mastered	50	700	["df8c0011-2a97-4607-a423-5cd43aaec857"]	0	0	1	5	alimentacin_1765883187549	\N			0
0415ec62-2fb8-4173-a1f2-6791bc91cdc9	\N	¿Será Cursor?		mastered	50	1300	["f684fd64-d695-41fe-be60-2efb6df3b3c8"]	0	0	2	5	lanzar_mi_app_1765465891458	\N			0
e0fde8e4-e7e3-4a05-8fd4-f75aefae49a6	\N	inicio		mastered	50	100	[]	0	0	1	1	lanzar_mi_app_1765465891458	\N			0
0a21dd93-104b-467b-bb52-ddd13538a813	\N			mastered	50	1000	[]	0	0	2	2	alexis_o_el_tratado_del_intil_combate_1765405345491	\N			0
34fc6622-f43d-42e0-b213-83ce1d9606c6	\N	Diseñar app		mastered	50	250	["e0fde8e4-e7e3-4a05-8fd4-f75aefae49a6"]	0	0	1	2	lanzar_mi_app_1765465891458	\N		Diseñá con IA lo máximo que puedas	0
3cf1ace6-0be7-425f-bc9e-43afc24e8958	msica	Cuerda 4ta		mastered	50	850	["f5743162-24b9-448e-8cd4-f706b3c9475f"]	0	0	1	7	\N	\N	Problema: Me lleva tiempo y varios intentos poder encontrar la nota que escucho sin ver\n\nHabilidad necesaria: El oído absoluto		0
8aa9be6e-33c2-48ef-9cee-46717754b6ff	\N	Explicar mi tema		mastered	50	1380	[]	0	1	2	6	alexis_o_el_tratado_del_intil_combate_1765405345491	\N			0
ce121026-18cf-4d07-a774-bc60028b4578	\N	Comprar		mastered	50	700	["af135ae0-5538-41a0-ad89-bb28c1d8a67d"]	0	0	1	8	botn_del_bao_1765396404032	\N	La respuesta me la dio el ferretero. Era la gomita.	Comprar para ajustar y preguntar	0
f5743162-24b9-448e-8cd4-f706b3c9475f	msica	Notas cuerda 5	Notas cuerda 5	mastered	50	400	["3669cd56-262e-4b1d-b2b5-e09dda8b9b3d"]	0	0	1	4	\N	\N			0
3669cd56-262e-4b1d-b2b5-e09dda8b9b3d	msica	Notas cuerda 5	Notas del diapasón con 5 y 4 cuerda	mastered	50	250	["6c7e4c0a-9960-4574-924e-3775ccfab13e"]	0	0	1	3	\N	\N			0
a5eb527a-296b-4625-9af6-360d2f85e03a	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	79c391af-a7c5-4bb5-a805-246138b7114c			0
d70cb977-71e7-4f4f-aeae-b8165e793e8d	\N	Roleplay: Tipo Podcast	Jugá a que sos una profe incríble que va a dar una clase	available	50	1300	["d70cb977-71e7-4f4f-aeae-b8165e793e8d"]	0	0	2	3	alexis_o_el_tratado_del_intil_combate_1765405345491	\N			0
e606eacd-dc20-4f25-99a6-42dda8ae726f	\N	Diseñá la app	como no tenés acceso a los cambios por IA porque te cobra los usos de la IA vamos a esperar a que se termine el premium para  poder usar la IA gratis a través de unos prompts bien diseñados	mastered	50	400	["34fc6622-f43d-42e0-b213-83ce1d9606c6"]	0	0	1	4	lanzar_mi_app_1765465891458	\N		Organizá en un documento los cambios necesarios	0
4344cb19-9e6a-4285-8ecc-57cda8d0d2d5	\N	Next challenge		locked	50	550	["7b19befe-3061-4add-93c6-a3c7413783c0"]	0	0	1	4	humedad_1765571174968	\N			0
361d3297-17b5-41da-a169-ec0ece99d6b7	\N			mastered	50	850	[]	0	0	2	2	lanzar_mi_app_1765465891458	\N			0
283fb666-2f50-4456-bd98-14799b0e2c14	\N	Armá un word		mastered	50	250	["283fb666-2f50-4456-bd98-14799b0e2c14"]	0	1	1	2	\N	e606eacd-dc20-4f25-99a6-42dda8ae726f		Armá un word separado en subtitulos con prompts	0
7a9e90b4-31df-4af2-910b-641cca72e5bd	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	e606eacd-dc20-4f25-99a6-42dda8ae726f			0
f314ed72-8390-4593-a5cc-85f3aa80850f	msica	inicio		mastered	50	100	[]	0	0	1	1	\N	\N			0
1b7149ce-e74d-4188-a835-26f4cf7026af	\N	Averiguar sobre GéminiCode	Ver cómo funciona Géminis code	mastered	50	700	["e606eacd-dc20-4f25-99a6-42dda8ae726f"]	0	0	1	4	lanzar_mi_app_1765465891458	\N			0
d3247da3-1f6e-4556-bc50-93c41ab65b1b	\N	Rellenar		mastered	50	250	["a4f7e820-2464-4772-b11c-44de81c1d5d8"]	0	0	1	2	humedad_1765571174968	\N		Tapá los agujeros que le entran el agua	0
33f71256-48fb-42d5-9fff-f21b321e790f	\N	Guión Level 3	Hacer un dialogo como si fuese que estoy explicando mi hipótesis: Entrar al tema de la individualización a la generalización	mastered	50	850	["33f8f506-c76e-4b9f-b6c8-2d68778c4c51"]	0	0	1	6	\N	01a7a2b2-d8e7-47c7-b1cc-7f2bf656af99			0
7b19befe-3061-4add-93c6-a3c7413783c0	\N	Next challenge		available	50	400	["d3247da3-1f6e-4556-bc50-93c41ab65b1b"]	0	0	1	3	humedad_1765571174968	\N			0
068793ae-519b-47f8-b186-75330b5bcc60	viajar	Next challenge		locked	50	1000	["a9d50f35-45c6-467c-ba28-0029a0cd0644"]	0	0	2	5	\N	\N			0
221bfe8e-c66b-41e6-8e60-828cbf0a6421	\N	Usar y esperar		mastered	50	250	["a5eb527a-296b-4625-9af6-360d2f85e03a"]	0	0	1	2	\N	79c391af-a7c5-4bb5-a805-246138b7114c		Seguí con otras cosas hasta que te manden el mail	0
63097951-ec6a-4e01-8568-319b0adadc11	\N	Pagar 		mastered	50	400	["221bfe8e-c66b-41e6-8e60-828cbf0a6421"]	0	0	1	3	\N	79c391af-a7c5-4bb5-a805-246138b7114c		Pagá primero para poder usarla	0
f042f359-4628-4073-8651-69f3e5d71ad2	\N	inicio		mastered	50	100	[]	0	0	1	1	leer_literatura_argentina_1768053900543	\N			0
f8519352-8d09-40e4-b722-d955e8881bda	\N			mastered	50	700	[]	0	0	2	1	\N	f684fd64-d695-41fe-be60-2efb6df3b3c8			0
4ac834ca-f634-4ca6-9096-9aa0680df593	\N	Next challenge		locked	50	700	["4344cb19-9e6a-4285-8ecc-57cda8d0d2d5"]	0	1	1	5	humedad_1765571174968	\N			0
22bc6a24-1f89-4aeb-a1f0-8716797cfc9e	\N	Negociá		mastered	50	550	["63097951-ec6a-4e01-8568-319b0adadc11"]	0	1	1	5	\N	79c391af-a7c5-4bb5-a805-246138b7114c		Seguí negociando y reenviando mail hasta que te den dinero	0
a4f7e820-2464-4772-b11c-44de81c1d5d8	\N	inicio		mastered	50	100	[]	0	0	1	1	humedad_1765571174968	\N			0
d1dad536-3904-4e42-8a99-2645c123579c	finanzas	Traumas financieros	Rever mis traumas financieros	available	50	1300	["e6d06c10-c056-4ede-a92f-ae58deff0f25"]	0	0	2	3	\N	\N			0
aee67cfe-b973-443b-810b-57728c38eed4	finanzas	Next challenge		locked	50	1600	["5b9c248c-a045-4510-b17c-37202f400a77"]	0	0	2	5	\N	\N			0
022fcc3f-1e19-483c-9cc8-65ccf61d9f4a	\N	inicio		mastered	50	100	[]	0	0	1	1	relacin_sana_1767217260261	\N			0
5b9c248c-a045-4510-b17c-37202f400a77	finanzas	Next challenge		locked	50	1450	["d1dad536-3904-4e42-8a99-2645c123579c"]	0	0	2	4	\N	\N			0
752d36de-f5f0-4431-8f25-a463ce037fb5	finanzas			mastered	50	1000	[]	0	0	2	1	\N	\N			0
2294ba1e-290b-4097-919f-96c856986b02	\N	Next challenge		locked	50	400	["03bd2e21-b68d-4a7c-a669-9e5d01b74655"]	0	0	1	3	leer_literatura_argentina_1768053900543	\N			0
8d8a8926-1d53-46bb-b02e-06ad1ba34e67	\N	Hablar estando procesando		mastered	50	400	["b64678e4-efba-4a30-a969-f1acd99e5549"]	0	0	1	6	relacin_sana_1767217260261	\N			0
8702451d-46eb-44cc-b761-adceafb12e98	\N	Next challenge		locked	50	850	["f8519352-8d09-40e4-b722-d955e8881bda"]	0	0	2	2	\N	f684fd64-d695-41fe-be60-2efb6df3b3c8			0
46fed013-1546-4d95-b946-416e69b17ec5	\N	Next challenge		locked	50	700	["175cfbc7-3f86-4dd4-908d-c341448258e7"]	0	0	1	5	lavadero_1767697136314	\N			0
01a7a2b2-d8e7-47c7-b1cc-7f2bf656af99	\N	Escribí siendo Walter	Escribir jugando a ser Walter y explicar la obra desde ahí	mastered	50	1150	["0a21dd93-104b-467b-bb52-ddd13538a813"]	0	0	2	1	alexis_o_el_tratado_del_intil_combate_1765405345491	\N			0
90a2acd3-de12-4cc7-b718-715dd13024fc	msica			mastered	50	1150	[]	0	0	2	4	\N	\N			0
bf0f2ca6-dc33-42ac-b565-006e08b65a09	\N	inicio		mastered	50	100	[]	0	0	1	1	\N	fc40b040-8b1e-4979-a398-06bae6cea0f6			0
32e6a4e4-23e3-402b-9f5a-07f2bdec59bc	\N	Next challenge		locked	50	1000	["8702451d-46eb-44cc-b761-adceafb12e98"]	0	0	2	3	\N	f684fd64-d695-41fe-be60-2efb6df3b3c8			0
310c1221-ec8e-403d-88bf-4e8083726135	\N	Next challenge		mastered	50	250	["bf0f2ca6-dc33-42ac-b565-006e08b65a09"]	0	0	1	2	\N	fc40b040-8b1e-4979-a398-06bae6cea0f6			0
88515618-6477-4d3e-8911-339c4591f045	\N	Next challenge		mastered	50	400	["310c1221-ec8e-403d-88bf-4e8083726135"]	0	0	1	3	\N	fc40b040-8b1e-4979-a398-06bae6cea0f6			0
7641b1ea-b5a4-4bbc-99e8-de188a0b9b5e	\N	Next challenge		mastered	50	550	["88515618-6477-4d3e-8911-339c4591f045"]	0	0	1	4	\N	fc40b040-8b1e-4979-a398-06bae6cea0f6			0
5b6e29e3-c3d6-4fb1-953b-0fc0d991a334	\N	Next challenge		mastered	50	700	["7641b1ea-b5a4-4bbc-99e8-de188a0b9b5e"]	0	1	1	5	\N	fc40b040-8b1e-4979-a398-06bae6cea0f6			0
79c391af-a7c5-4bb5-a805-246138b7114c	\N	Pedir un reembolso	Al entrar a tu cuenta del banco ves un cargo de 200 dólares hecho por la app que usabas, sin ningún aviso previo. El cobro te bloqueó el acceso a la app y cada día que pasa no podés avanzar con tu proyecto, además de que podrían generarse impuestos por pagos internacionales no autorizados. Si enviás mails claros y reunís buenos argumentos, quizás puedas recuperar el dinero	mastered	50	550	["79c391af-a7c5-4bb5-a805-246138b7114c"]	0	0	1	3	lanzar_mi_app_1765465891458	\N		Pedí un reembolso por errores del sistema	0
2d6ef4dd-55f7-4745-bb3d-f8ce87891b2b	\N	Voy a caminar	Cuando me angustio mucho pienso “quiero irme a mi casa” y preparo todo para irme pero Flor se queda llorando y eso me duele muchísimo. Quedamos en que hablara aunque no lo tenga del todo procesado o que diga que me iba a caminar.	locked	50	1000	["2d6ef4dd-55f7-4745-bb3d-f8ce87891b2b"]	0	0	1	6	relacin_sana_1767217260261	\N			0
9cd81e2e-5fe2-4763-827b-a57a90b7ed86	msica	3 era cuerda		mastered	50	1450	["9cd81e2e-5fe2-4763-827b-a57a90b7ed86"]	0	0	2	5	\N	\N	Problema: zx\n\nHabilidad necesaria: Zx		0
97b36336-48a0-4c2c-b1f5-c29aa036dc9a	\N	Analizá las citas	Ir cita por cita detallando lo que encuentro	mastered	50	550	["e52fd32b-3f2b-4674-82c9-8edf6cb9a2cb"]	0	0	1	5	alexis_o_el_tratado_del_intil_combate_1765405345491	\N			0
ae1e34f8-6b6a-4129-9646-9fd71c967c96	msica	Next challenge		locked	50	2200	["16a65fe3-51fc-4230-98cd-1b5723221054"]	0	0	3	6	\N	\N			0
16a65fe3-51fc-4230-98cd-1b5723221054	msica	Next challenge		locked	50	2050	["1cdc2d17-9efb-4c4a-8008-378e5d9b5de4"]	0	0	3	5	\N	\N			0
a96234f6-4fc7-4ccf-8ceb-1a60aff031f9	msica	3 y 4		available	50	1600	["e67e8f82-d142-48fd-a7d6-0c027feb726b"]	0	0	2	7	\N	\N			0
7f0e1c22-52be-4c56-94fa-a9944705abdd	msica	Next challenge		locked	50	2350	["ae1e34f8-6b6a-4129-9646-9fd71c967c96"]	0	0	3	7	\N	\N			0
e4d7f104-b234-47a7-9d03-ad113147153a	\N	Next challenge		locked	50	1150	["32e6a4e4-23e3-402b-9f5a-07f2bdec59bc"]	0	0	2	4	\N	f684fd64-d695-41fe-be60-2efb6df3b3c8			0
79c62415-8d67-45d1-a36f-d709812f17bb	\N	Next challenge		locked	50	1300	["e4d7f104-b234-47a7-9d03-ad113147153a"]	0	0	2	5	\N	f684fd64-d695-41fe-be60-2efb6df3b3c8			0
4ddaa924-a321-432c-96ad-2bc36da44d79	\N	Next challenge		locked	50	550	["2294ba1e-290b-4097-919f-96c856986b02"]	0	0	1	4	leer_literatura_argentina_1768053900543	\N			0
e604ba5e-6778-4178-a834-dd35733f82c6	social	Next challenge		locked	50	700	["71e68205-85c1-4d2c-8414-21bc012e5498"]	0	0	1	5	\N	\N			0
b42fa0af-b0d0-4038-8b24-39f3ca8554f4	msica	Next challenge		locked	50	2500	["7f0e1c22-52be-4c56-94fa-a9944705abdd"]	0	0	3	8	\N	\N			0
8c87aaa9-45f5-4db1-8a8a-561164ad3732	msica	Next challenge		locked	50	1750	["a96234f6-4fc7-4ccf-8ceb-1a60aff031f9"]	0	0	2	8	\N	\N			0
1cdc2d17-9efb-4c4a-8008-378e5d9b5de4	msica			locked	50	1900	[]	0	0	3	4	\N	\N			0
9016f679-a425-4620-9a72-1c005c171dec	\N	Rol organizadora tiempo	Con flor nos peleamos muchas veces por no organizarnos bien con el tiempo. Para solucionar eso quedamos en que una es la que organiza y decide cuanto tiempo para cada cosa asi llegamos bien	locked	50	850	["8d8a8926-1d53-46bb-b02e-06ad1ba34e67"]	0	0	1	4	relacin_sana_1767217260261	\N			0
e67e8f82-d142-48fd-a7d6-0c027feb726b	msica	4,5 y 6		mastered	50	1300	["90a2acd3-de12-4cc7-b718-715dd13024fc"]	0	0	2	6	\N	\N			0
b64678e4-efba-4a30-a969-f1acd99e5549	\N	Ponerme seria	Despues de decir un chiste que se lo toma en serio tirandome un palo tengo que ponerme seria y ser clara con que fue un chiste	mastered	50	250	["022fcc3f-1e19-483c-9cc8-65ccf61d9f4a"]	0	0	1	2	relacin_sana_1767217260261	\N	Problema: Flor a veces toma mis chistes como para decir algo que le molestó, se enoja y a veces me siento acusada de algo. Algo le duele de lo que interpretó del chiste.\n\nHabilidad necesaria: Poder no seguir la joda y ponerme seria cuando algo le duele y aclarar con tranquilidad. Darle espacio a su enojo.		0
f684fd64-d695-41fe-be60-2efb6df3b3c8	\N	Pasos de gemini	Pasar de replit a Firebase con los pasos de Gemini	mastered	50	1150	["fc40b040-8b1e-4979-a398-06bae6cea0f6"]	0	0	2	4	lanzar_mi_app_1765465891458	\N			0
e6d06c10-c056-4ede-a92f-ae58deff0f25	finanzas	Categorizar en mercadopago	Quiero saber cuanto necesito para cada área así puedo priorizar mis gastos a lo que realmente importa: la comida y la vivienda	mastered	50	1150	["752d36de-f5f0-4431-8f25-a463ce037fb5"]	0	0	2	2	\N	\N			0
6d54a0ba-2215-4988-9aba-dc7f03e38c7d	\N	Es github copilot		mastered	50	1450	["0415ec62-2fb8-4173-a1f2-6791bc91cdc9"]	0	0	2	6	lanzar_mi_app_1765465891458	\N			0
01c7632c-f1ff-4be3-ab4d-202b0d4bb6f6	\N	¿Visualizar en VisualCode?	Estoy intentando correr la app en Visual Code para poder seguir editando con la ayuda de Github Copilot así no tengo restricciones.	mastered	50	2050	["01c7632c-f1ff-4be3-ab4d-202b0d4bb6f6"]	0	0	3	4	lanzar_mi_app_1765465891458	\N			0
dc7b7cdf-0936-4910-ac41-92f3037a74fe	\N	Next challenge		locked	50	700	["4ddaa924-a321-432c-96ad-2bc36da44d79"]	0	0	1	5	leer_literatura_argentina_1768053900543	\N			0
03bd2e21-b68d-4a7c-a669-9e5d01b74655	\N	¿Cuáles son los libros?	Organiza una lista de libros 	available	50	250	["f042f359-4628-4073-8651-69f3e5d71ad2"]	0	0	1	2	leer_literatura_argentina_1768053900543	\N			0
55d9c1e2-e042-400a-bfec-95a0623eea84	viajar	Buscar compañera de viaje: hablarle a Pilu	Quiero surfear este verano pero el precio es muy alto para irme un mes. Tengo que tomar una decisión.	available	50	550	["42b826d0-4b16-4754-b7ba-28b063c059ba"]	0	0	2	2	\N	\N			0
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, created_at, profile_mission, profile_values, profile_likes, profile_about) FROM stdin;
6a41c5e7-7f1b-44c0-a2e9-f2992a54a83f	chinita	2025-12-08 14:06:43.952758				
08e66067-455d-4c30-9b72-3207814484b3	carla	2025-12-10 15:38:13.365602				
b714848c-4c0d-413f-a97e-824f99c5cd2a	javier	2025-12-10 15:39:53.502942				
9ef95abf-ca27-4e2c-84c5-649030a719a9	norma	2025-12-10 17:01:59.271019				
b64e96cf-c338-4e1f-aa91-efacf58deddf	carlota	2025-12-10 17:28:22.753188				
f8adec74-bf8c-45ca-aca5-45b0896cafae	cane	2025-12-08 13:13:01.376586				Tengo una ambición interminable por crecer
\.


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: journal_characters journal_characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_characters
    ADD CONSTRAINT journal_characters_pkey PRIMARY KEY (id);


--
-- Name: journal_learnings journal_learnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_learnings
    ADD CONSTRAINT journal_learnings_pkey PRIMARY KEY (id);


--
-- Name: journal_places journal_places_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_places
    ADD CONSTRAINT journal_places_pkey PRIMARY KEY (id);


--
-- Name: journal_shadows journal_shadows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_shadows
    ADD CONSTRAINT journal_shadows_pkey PRIMARY KEY (id);


--
-- Name: journal_tools journal_tools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_tools
    ADD CONSTRAINT journal_tools_pkey PRIMARY KEY (id);


--
-- Name: profile_about_entries profile_about_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_about_entries
    ADD CONSTRAINT profile_about_entries_pkey PRIMARY KEY (id);


--
-- Name: profile_likes profile_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_likes
    ADD CONSTRAINT profile_likes_pkey PRIMARY KEY (id);


--
-- Name: profile_missions profile_missions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_missions
    ADD CONSTRAINT profile_missions_pkey PRIMARY KEY (id);


--
-- Name: profile_values profile_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_values
    ADD CONSTRAINT profile_values_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: skills skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: areas areas_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: journal_characters journal_characters_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_characters
    ADD CONSTRAINT journal_characters_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: journal_learnings journal_learnings_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_learnings
    ADD CONSTRAINT journal_learnings_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: journal_places journal_places_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_places
    ADD CONSTRAINT journal_places_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: journal_shadows journal_shadows_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_shadows
    ADD CONSTRAINT journal_shadows_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: journal_tools journal_tools_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_tools
    ADD CONSTRAINT journal_tools_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: profile_about_entries profile_about_entries_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_about_entries
    ADD CONSTRAINT profile_about_entries_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: profile_likes profile_likes_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_likes
    ADD CONSTRAINT profile_likes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: profile_missions profile_missions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_missions
    ADD CONSTRAINT profile_missions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: profile_values profile_values_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_values
    ADD CONSTRAINT profile_values_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: skills skills_area_id_areas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_area_id_areas_id_fk FOREIGN KEY (area_id) REFERENCES public.areas(id) ON DELETE CASCADE;


--
-- Name: skills skills_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


