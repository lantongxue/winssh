import { motion } from "motion/react";
import { Cpu, FolderSync, Activity, ShieldCheck, History, Github } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

export function Features() {
  const { t } = useLanguage();
  
  const features = [
    {
      icon: <Cpu className="w-6 h-6 text-blue-400" />,
      title: t.features.items[0].title,
      description: t.features.items[0].desc
    },
    {
      icon: <FolderSync className="w-6 h-6 text-purple-400" />,
      title: t.features.items[1].title,
      description: t.features.items[1].desc
    },
    {
      icon: <Activity className="w-6 h-6 text-cyan-400" />,
      title: t.features.items[2].title,
      description: t.features.items[2].desc
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-green-400" />,
      title: t.features.items[3].title,
      description: t.features.items[3].desc
    },
    {
      icon: <History className="w-6 h-6 text-yellow-400" />,
      title: t.features.items[4].title,
      description: t.features.items[4].desc
    },
    {
      icon: <Github className="w-6 h-6 text-neutral-300" />,
      title: t.features.items[5].title,
      description: t.features.items[5].desc
    }
  ];

  return (
    <section id="features" className="py-32 px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="font-display text-4xl md:text-6xl font-bold tracking-tight"
          >
            {t.features.titleLevel1} <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">{t.features.titleLevel2}</span>
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.8, delay: i * 0.2 }}
              className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group relative overflow-hidden"
            >
              {/* Subtle hover gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10">
                {feature.icon}
              </div>
              <h3 className="text-xl font-display font-semibold mb-3 text-white">{feature.title}</h3>
              <p className="text-neutral-400 leading-relaxed font-light">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
